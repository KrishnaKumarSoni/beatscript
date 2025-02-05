from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from crewai import Crew
import json
import asyncio
from agents import MusicAgents
from tasks import MusicTasks

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TitleRequest(BaseModel):
    title: str

@app.post("/api/extract-song-info")
async def extract_song_info(request: TitleRequest):
    try:
        # Initialize agents and tasks
        agents = MusicAgents()
        tasks = MusicTasks()
        
        # Create the agents
        search_agent = agents.search_agent()
        extraction_agent = agents.music_extraction_agent()
        
        # Create the tasks in sequence
        search_task = tasks.search_task(search_agent, request.title)
        
        # Create and run the search crew
        search_crew = Crew(
            agents=[search_agent],
            tasks=[search_task],
            verbose=True
        )
        
        # Run the search crew in a thread pool
        loop = asyncio.get_event_loop()
        search_result = await loop.run_in_executor(None, search_crew.kickoff)
        
        try:
            # Convert CrewOutput to string and clean it
            search_result_str = str(search_result).strip()
            
            # Extract JSON from the result
            import re
            json_match = re.search(r'\{[^}]+\}', search_result_str)
            if not json_match:
                print("No valid JSON found in search result")
                return {
                    "song": "Unknown Song",
                    "artist": "Unknown Artist"
                }
            
            # Parse the search results
            search_data = json.loads(json_match.group(0))
            
            # If no song found in search, return unknown
            if not search_data.get('found', False):
                print("No song found in search")
                return {
                    "song": "Unknown Song",
                    "artist": "Unknown Artist"
                }
            
            # Create the extraction task with search results
            extraction_task = tasks.extract_info_task(
                extraction_agent,
                request.title,
                json.dumps(search_data)  # Convert to JSON string
            )
            
            # Create and run the extraction crew
            extraction_crew = Crew(
                agents=[extraction_agent],
                tasks=[extraction_task],
                verbose=True
            )
            
            # Run the extraction crew
            result = await loop.run_in_executor(None, extraction_crew.kickoff)
            
            # Parse the final result
            result_str = str(result).strip()
            json_match = re.search(r'\{[^}]+\}', result_str)
            
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except json.JSONDecodeError as e:
                    print(f"Error parsing extraction result JSON: {str(e)}")
            
            # Fallback parsing
            song_match = re.search(r'"song":\s*"([^"]+)"', result_str)
            artist_match = re.search(r'"artist":\s*"([^"]+)"', result_str)
            
            return {
                "song": song_match.group(1) if song_match else "Unknown Song",
                "artist": artist_match.group(1) if artist_match else "Unknown Artist"
            }
                
        except Exception as e:
            print(f"Error processing extraction: {str(e)}")
            return {
                "song": "Unknown Song",
                "artist": "Unknown Artist"
            }
            
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 