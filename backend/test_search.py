from tools import GoogleSearchTool

def test_search():
    search_tool = GoogleSearchTool()
    
    # Test cases
    test_titles = [
        "Ed Sheeran - Perfect (Official Music Video)",
        "Jaane Tu | Chhaava | Vicky Kaushal, Rashmika Mandanna | A. R. Rahman, Arijit Singh, Irshad Kamil",
        "Taylor Swift - Cruel Summer (Official Video)",
        "Shape of You - Ed Sheeran"
    ]
    
    print("\nTesting GoogleSearchTool...")
    print("=" * 50)
    
    for title in test_titles:
        print(f"\nTesting title: {title}")
        print("-" * 50)
        
        query = f'what is the name of this song - {title}'
        result = search_tool._run(query)
        
        print("\nSearch Results:")
        print(result)
        print("\n" + "=" * 50)

if __name__ == "__main__":
    test_search() 