from crewai import Agent
from dotenv import load_dotenv
import os
from tools import GoogleSearchTool

load_dotenv()

class MusicAgents:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.search_tool = GoogleSearchTool()

    def search_agent(self):
        return Agent(
            role='Music Search Specialist',
            goal='Search and verify song information from YouTube titles',
            backstory="""You are an expert in finding and verifying song information. 
            Your job is to search for potential song names in YouTube video titles and 
            verify them using web search results.""",
            tools=[self.search_tool],
            verbose=True,
            allow_delegation=False,
            llm_model="gpt-3.5-turbo"
        )

    def music_extraction_agent(self):
        return Agent(
            role='Music Information Extractor',
            goal='Extract accurate song and artist information from YouTube titles and search results',
            backstory="""You are an expert in music metadata extraction. Your job is to 
            analyze YouTube video titles along with search results to accurately identify 
            the song name and artist. You should compare the YouTube title with the search 
            results to ensure accuracy.""",
            tools=[],
            verbose=True,
            allow_delegation=False,
            llm_model="gpt-3.5-turbo"
        ) 