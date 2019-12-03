CLIENT_ID=0 docker-compose up

export SOCKET_IO_URL="http://localhost:8080"
export DISPLAY="192.168.1.10:0.0"
python app.py

CLIENT_ID=1 docker-compose up
