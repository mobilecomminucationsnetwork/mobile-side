import websocket
import json
import time

# This should match the URL used in your app
WS_URL = 'ws://161.35.195.142:8000/ws/doors/e43b48ac-6cce-430e-a119-5c5ff5d62967/'

def on_message(ws, message):
    print(f"Received message: {message}")
    
    try:
        data = json.loads(message)
        
        # If we receive a door command, respond with appropriate status
        if data.get("type") == "door_command":
            if data.get("command") == "open":
                # Respond with OPENED status to match your hardware behavior
                response = json.dumps({"type": "door_status", "status": "OPENED"})
                ws.send(response)
                print(f"Sent response: {response}")
            elif data.get("command") == "close":
                # Respond with CLOSED status to match your hardware behavior
                response = json.dumps({"type": "door_status", "status": "CLOSED"})
                ws.send(response)
                print(f"Sent response: {response}")
    except json.JSONDecodeError:
        print(f"Received non-JSON message: {message}")

def on_error(ws, error):
    print(f"Error: {error}")

def on_close(ws, close_status_code, close_msg):
    print(f"Connection closed: {close_status_code} - {close_msg}")

def on_open(ws):
    print("Connection opened")
    
    # Send an initial status to the app
    initial_status = json.dumps({"type": "door_status", "status": "CLOSED"})
    ws.send(initial_status)
    print(f"Sent initial status: {initial_status}")

if __name__ == "__main__":
    # Connect to WebSocket server
    ws = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Start the WebSocket connection in a separate thread
    import threading
    wst = threading.Thread(target=ws.run_forever)
    wst.daemon = True
    wst.start()
    
    # Keep the main thread running
    try:
        while True:
            # You can add commands here to simulate hardware behaviors
            # For example, to simulate door opening after 5 seconds:
            time.sleep(5)
            print("\nOptions:")
            print("1. Simulate door opened")
            print("2. Simulate door closed")
            print("3. Exit")
            
            choice = input("Enter choice (1-3): ")
            
            if choice == "1":
                status = json.dumps({"type": "door_status", "status": "OPENED"})
                ws.send(status)
                print(f"Sent: {status}")
            elif choice == "2":
                status = json.dumps({"type": "door_status", "status": "CLOSED"})
                ws.send(status)
                print(f"Sent: {status}")
            elif choice == "3":
                break
            
    except KeyboardInterrupt:
        pass
    finally:
        ws.close()
