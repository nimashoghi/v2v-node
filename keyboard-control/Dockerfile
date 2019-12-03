FROM balenalib/raspberry-pi-debian-python

RUN ["cross-build-start"]

RUN apt-get update && apt-get install --no-install-recommends --yes python-tk tk-dev

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN ["cross-build-end"]

CMD [ "python", "./app.py" ]
