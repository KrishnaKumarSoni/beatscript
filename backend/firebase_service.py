import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import os
import json
import base64
import logging

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
firebase_initialized = False
db = None

def format_private_key(key):
    """Format private key string to proper PEM format"""
    # First, handle escaped newlines
    key = key.encode().decode('unicode_escape')
    
    # Remove any existing headers/footers and whitespace
    key = key.replace('-----BEGIN PRIVATE KEY-----', '')
    key = key.replace('-----END PRIVATE KEY-----', '')
    key = key.replace(' ', '')
    key = key.replace('\n', '')
    
    # Split into lines of appropriate length
    lines = []
    chunk_size = 64
    for i in range(0, len(key), chunk_size):
        lines.append(key[i:i + chunk_size])
    
    # Join with newlines and add headers
    formatted_key = '\n'.join(lines)
    return f"-----BEGIN PRIVATE KEY-----\n{formatted_key}\n-----END PRIVATE KEY-----"

try:
    # Try to use environment variables first
    if os.environ.get('FIREBASE_PRIVATE_KEY') and os.environ.get('FIREBASE_CLIENT_EMAIL'):
        # Get the raw private key and handle newlines
        private_key = os.environ['FIREBASE_PRIVATE_KEY']
        logger.info("Found Firebase private key in environment variables")
        
        # Format the private key
        private_key = format_private_key(private_key)
        logger.info("Formatted Firebase private key")
        
        cred_dict = {
            "type": "service_account",
            "project_id": os.environ.get('FIREBASE_PROJECT_ID', 'beatscript-ffcd2'),
            "private_key": private_key,
            "client_email": os.environ['FIREBASE_CLIENT_EMAIL'],
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": os.environ.get('FIREBASE_CLIENT_X509_CERT_URL', '')
        }
        logger.info(f"Attempting Firebase initialization with project ID: {cred_dict['project_id']}")
        
        # Print the first few characters of the private key for debugging
        logger.info(f"Private key starts with: {private_key[:50]}...")
        
        cred = credentials.Certificate(cred_dict)
    else:
        logger.warning("Firebase environment variables not found")
        # Fallback to local file for development
        cred = credentials.Certificate('beatscript-ffcd2-firebase-adminsdk-fbsvc-02a1f48daf.json')
    
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    firebase_initialized = True
    logger.info("Firebase initialized successfully")
except Exception as e:
    logger.error(f"Firebase initialization failed: {str(e)}")
    logger.error(f"Environment variables available: {list(os.environ.keys())}")
    raise  # Re-raise the exception to fail fast

class FirebaseService:
    def __init__(self):
        if firebase_initialized:
            self.songs_collection = db.collection('songs')
            self.stats_collection = db.collection('stats')
        else:
            self.songs_collection = None
            self.stats_collection = None

    async def save_song(self, song_data):
        """
        Save a song to Firebase with metadata, only if it doesn't already exist
        """
        if not firebase_initialized:
            return {'success': False, 'error': 'Firebase not initialized'}
            
        try:
            # First check if song exists for this video ID
            existing_song = await self.check_song_exists(song_data['video_id'])
            if existing_song['exists']:
                return {'success': False, 'error': 'Song already exists for this video', 'existing_id': existing_song['id']}
            
            # Create a unique document ID using just the video ID
            doc_id = song_data['video_id']
            
            # Prepare the document data
            doc_data = song_data.copy()
            doc_data['created_at'] = datetime.utcnow()
            
            # Add the document
            self.songs_collection.document(doc_id).set(doc_data)
            return {'success': True, 'id': doc_id}
        except Exception as e:
            print(f"Error saving song to Firebase: {str(e)}")
            return {'success': False, 'error': str(e)}

    async def check_song_exists(self, video_id):
        """
        Check if a song already exists for a given video ID
        """
        if not firebase_initialized:
            return {'exists': False, 'id': None}
            
        try:
            doc = self.songs_collection.document(video_id).get()
            return {'exists': doc.exists, 'id': video_id if doc.exists else None}
        except Exception as e:
            print(f"Error checking song existence: {str(e)}")
            return {'exists': False, 'id': None}

    async def update_stats(self, stat_type, data):
        """
        Update statistics in Firebase
        """
        if not firebase_initialized:
            return {'success': False, 'error': 'Firebase not initialized'}
            
        try:
            # Create a document with current timestamp
            doc_data = {
                'type': stat_type,
                'data': data,
                'timestamp': datetime.utcnow()
            }
            self.stats_collection.add(doc_data)
            return {'success': True}
        except Exception as e:
            print(f"Error updating stats: {str(e)}")
            return {'success': False, 'error': str(e)}

# Create a singleton instance
firebase_service = FirebaseService() 