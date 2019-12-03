# import the necessary packages
from pyzbar import pyzbar
import cv2
import socketio
import os
import time
sio = socketio.Client()


# construct the argument parser and parse the arguments
# ap = argparse.ArgumentParser()
# ap.add_argument("-n", "--ip", required=True,
# 	help="server ip address")
# ap.add_argument("-v", "--video", required=True,
# 	help="video")
# args = vars(ap.parse_args())
ip = os.environ["IP_ADDRESS"]
video = os.environ["VIDEO_INPUT"]
try:
	video = int(video)
except:
	pass
print('http://{address}:8080'.format(address=ip))
sio.connect('http://{address}:8080'.format(address=ip))

cap = cv2.VideoCapture(video)
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

	barcodes = pyzbar.decode(frame)
		# loop over the detected barcodes
		# data_list = [{"publicKey": f"-----BEGIN RSA PUBLIC KEY-----{b.data.decode('utf-8')}-----END RSA PUBLIC KEY-----"} for b in barcodes]
		#
		# if(len(data_list) > 0):
		#     sio.emit("qr-codes",{"codes":data_list})
		#     print({"codes":data_list})
	data_list = []
	for barcode in barcodes:
		location = 'CENTER'
	# extract the bounding box location of the barcode and draw the
	# bounding box surrounding the barcode on the image
		(x, y, w, h) = barcode.rect
		print(x,y,w,h)

		if((x+(w/2.0)) < lower):
			# cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 2)
			location = 'LEFT'
		elif ((x+(w/2.0)) > upper):
			# cv2.rectangle(frame, (x, y), (x + w, y + h),(0, 0, 255), 2)
			location = 'RIGHT'
		# else:
		# 	cv2.rectangle(frame, (x, y), (x + w, y + h),(0, 255, 0), 2)
		# the barcode data is a bytes object so if we want to draw it on
		# our output image we need to convert it to a string first
		barcodeData = barcode.data.decode("utf-8").replace('\n','')
		barcodeType = barcode.type
		data_list.append({"publicKey": "-----BEGIN RSA PUBLIC KEY-----{}-----END RSA PUBLIC KEY-----".format(barcodeData),"location":location})

		# draw the barcode data and barcode type on the image
		text = "{} ({})".format(barcodeData, barcodeType)
		# cv2.putText(frame, text, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX,
		# 	0.5, (0, 0, 255), 2)

		# print the barcode type and data to the terminal
		print("[INFO] Found {} barcode: {}".format(barcodeType, barcodeData))
	if(len(data_list) > 0):
		sio.emit("qr-codes",{"codes":data_list})
		print({"codes":data_list})
	# show the output image
	# cv2.imshow("Image", frame)
	# if cv2.waitKey(1) & 0xFF == ord('q'):
		# break
	print("Processing Time: " + str(time.time() - start))
	time.sleep(1)

# cv2.waitKey(0)
