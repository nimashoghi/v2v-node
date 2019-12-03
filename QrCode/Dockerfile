FROM mohaseeb/raspberrypi3-python-opencv

RUN apt-get update && apt-get install --yes --no-install-recommends libzbar-dev

WORKDIR /app
COPY ./requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD python detect.py
