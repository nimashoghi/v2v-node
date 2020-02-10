# import the necessary packages
# from pyzbar import pyzbar
import cv2
# import socketio
# import os
import time
import zxing

cap = cv2.VideoCapture(0)
lane_width = 0
while True:
	start = time.time()
	# find the barcodes in the image and decode each of the barcodes
	ret, frame = cap.read()
	height, width = frame.shape[:2]
	lane_width = width/3.0
	center = width/2.0
	lower = center - lane_width
	upper = center + lane_width

	result = zxing.decode(frame, format=[zxing.BarcodeFormat.QR_CODE], fastMode=True)
	print(time.time() - start)
	print(result.text)
	print(result.valid)

# cv2.waitKey(0)
