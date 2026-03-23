from typing import Union, List, Dict, Any, Optional
import os
import asyncio
import json
from loguru import logger
import numpy as np

from .conversation_utils import (
    create_batch_input,
    process_agent_output,
    send_conversation_start_signals,
    process_user_input,
    finalize_conversation_turn,
    cleanup_conversation,
    EMOJI_LIST,
)
from .types import WebSocketSend
from .tts_manager import TTSTaskManager
from ..chat_history_manager import store_message
from ..service_context import ServiceContext

# Import necessary types from agent outputs
from ..agent.output_types import SentenceOutput, AudioOutput


async def process_single_conversation(
    context: ServiceContext,
    websocket_send: WebSocketSend,
    client_uid: str,
    user_input: Union[str, np.ndarray],
    images: Optional[List[Dict[str, Any]]] = None,
    session_emoji: str = np.random.choice(EMOJI_LIST),
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    tts_manager = TTSTaskManager()
    full_response = ""
    
    # Expression + Motion Mapping
    mapping = {
        "happy":     {"face": "happy",     "motion": "Sway"},
        "excited":   {"face": "excited",   "motion": "FlickUp"},
        "sad":       {"face": "sad",       "motion": "FlickDown"},
        "annoyed":   {"face": "annoyed",   "motion": "Flick@Body"},
        "thinking":  {"face": "thinking",  "motion": "Flick"},
        "surprised": {"face": "surprised", "motion": "Tap 0"},
        "smug":      {"face": "smug",      "motion": "Flick"} 
    }

    try:
        # 1. READ VISION (Only for context, NO MORE auto-reflexes!)
        observation = ""
        if os.path.exists("current_observation.txt"):
            with open("current_observation.txt", "r") as f:
                observation = f.read().strip()
            
        await send_conversation_start_signals(websocket_send)
        input_text = await process_user_input(user_input, context.asr_engine, websocket_send)

        # 2. CONSTRUCT PROMPT (Strict Instructions)
        batch_input = create_batch_input(
            input_text=input_text, 
            images=images, 
            from_name=context.character_config.human_name, 
            metadata=metadata
        )

        # STREAM LLM RESPONSE
        agent_output_stream = context.agent_engine.chat(batch_input)
        async for output_item in agent_output_stream:
            if isinstance(output_item, SentenceOutput):
                
                # Capture text for this sentence
                if hasattr(output_item, 'display_text') and output_item.display_text:
                    current_text = output_item.display_text.text
                else:
                    current_text = output_item.tts_text
                
                full_response += current_text

                # --- 🎭 DYNAMIC EMOTION CHECK ---
                import re
                import string
                
                # 1. INITIALIZE AS NONE FOR EVERY NEW SENTENCE
                current_emotion = None 
                
                tag_match = re.search(r"[\[\(\*](.*?)[\]\)\*]", current_text)
                
                if tag_match:
                    raw_tag = tag_match.group(1).lower().strip(string.punctuation + " ")
                    if raw_tag in mapping:
                        logger.info(f"🎭 [LIVE REACTION] Sentence had tag: {raw_tag}")
                        
                        # 2. ASSIGN THE EMOTION IF WE FOUND ONE
                        current_emotion = mapping[raw_tag] 

                # 3. PROCESS OUTPUT 
                await process_agent_output(
                    output=output_item,
                    character_config=context.character_config,
                    live2d_model=context.live2d_model,
                    tts_engine=context.tts_engine,
                    websocket_send=websocket_send,
                    tts_manager=tts_manager,
                    translate_engine=context.translate_engine,
                    emotion=current_emotion 
                )

        
        # WAIT FOR AUDIO TO FINISH GENERATING/SENDING
        if tts_manager.task_list:
            await asyncio.gather(*tts_manager.task_list)
            
        # ⏱️ ADD A SMALL BUFFER DELAY
        # This gives the Electron frontend time to actually play the audio 
        # it just received before we hammer it with the 'neutral' command.
        await asyncio.sleep(1.5) 

        # 🧼 THE AUTO-RESET: Now it's safe to go neutral
        await websocket_send(json.dumps({
            "type": "control", 
            "command": "set-expression", 
            "expression": "neutral"
        }))
        
        await finalize_conversation_turn(tts_manager, websocket_send, client_uid)
        return full_response

    except Exception as e:
        logger.error(f"Error: {e}")
        raise
    finally:
        cleanup_conversation(tts_manager, session_emoji)