FROM mohaseeb/raspberrypi3-python-opencv

RUN apt-get update && apt-get install --yes --no-install-recommends build-essential cmake git

RUN git clone https://github.com/nu-book/zxing-cpp.git \
    && cd zxing-cpp/wrappers/python/ \
    && python setup.py install \
    && cd ../../..

WORKDIR /app
COPY ./requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD python detect.py
