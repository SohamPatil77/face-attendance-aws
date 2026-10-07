# FaceTrack – AI Face Recognition Attendance System on AWS

A MERN-stack web application that marks classroom attendance automatically using face recognition, deployed on **Amazon Web Services (EC2 + S3 + IAM + CloudWatch)**.

## How it works

1. **Register** – a student's face is captured 3–5 times (webcam or photo upload).
   The AI (face-api.js on TensorFlow.js) detects the face, finds 68 landmarks and
   converts it into a **128-number face descriptor** using a ResNet-34 network.
   Descriptors are stored in MongoDB; face photos are stored in Amazon S3.
2. **Take attendance** – the webcam (or an uploaded class photo) is scanned; every face
   is turned into a descriptor and sent to the server on EC2.
3. **Match** – the server compares each descriptor with all registered students using
   **Euclidean distance**. Distance < 0.5 → same person. A greedy one-to-one assignment
   prevents one student from being matched twice.
4. **Record** – recognised students are marked present (one record per student, subject
   and day). A snapshot of the class is saved to S3. Reports can be exported as CSV.

## Architecture

```
 Browser (React + face-api.js / TensorFlow.js)
     │  HTTPS (Let's Encrypt, sslip.io hostname)
     ▼
 AWS ap-south-1 (Mumbai)
 ┌─────────────────────────── EC2 (Ubuntu 24.04, t2/t3.micro) ───────────────────────────┐
 │ Nginx (80/443) ──► Node.js + Express API (port 5000, systemd) ──► MongoDB 8 (local)   │
 └───────────────┬────────────────────────────────────────────────────────────────────────┘
                 │ IAM role (no access keys in code)
                 ▼
          Amazon S3 bucket (face photos, attendance snapshots – private)
 CloudWatch: CPU / network metrics, alarm, dashboard     Security Group: 22, 80, 443
 Elastic IP: fixed public address
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router |
| AI | @vladmandic/face-api (face-api.js) on TensorFlow.js – SSD MobileNet V1, Tiny Face Detector, 68-point landmarks, ResNet-34 face recognition |
| Backend | Node.js 22, Express 4, Mongoose 8 |
| Database | MongoDB 8.0 Community (on EC2) |
| Cloud | AWS EC2, S3, IAM, Elastic IP, Security Groups, CloudWatch |
| Web server | Nginx reverse proxy + Let's Encrypt (certbot) |

## Project structure

```
client/   React app (pages: Dashboard, Take Attendance, Register, Students, Records)
server/   Express API (routes: /api/students, /api/attendance, /api/files, /api/health)
deploy/   EC2 user-data script, Nginx config, HTTPS script, IAM policy, update script
```

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Server, DB, storage and EC2 instance info |
| GET / POST / DELETE | /api/students | List / register / delete students |
| POST | /api/attendance/recognize | Match face descriptors with students |
| POST | /api/attendance/mark | Mark recognised students present |
| GET | /api/attendance?date=&subject= | Attendance records |
| GET | /api/attendance/stats | Dashboard statistics |
| GET | /api/attendance/export.csv | CSV export |
| GET | /api/files/:key | Stream an image from S3 |

## Run locally

```bash
# needs Node 20+ and MongoDB running on localhost:27017
cd server && npm install && npm start        # API on :5000 (uses ./uploads instead of S3)
cd client && npm install && npm run dev      # React on :5173
```

## Deploy on AWS

1. Create a private S3 bucket in `ap-south-1`.
2. Create an IAM role for EC2 with the policy in `deploy/iam-policy.json` (bucket name filled in).
3. Launch an Ubuntu 24.04 EC2 instance (t2.micro / t3.micro), security group with ports 22, 80, 443,
   attach the IAM role, and paste `deploy/user-data.sh` (with the bucket name) into **User data**.
4. Allocate an Elastic IP and associate it with the instance.
5. Connect with EC2 Instance Connect and run `sudo bash /opt/face-attendance/deploy/setup-https.sh`.
6. Open the printed `https://<ip>.sslip.io` address.
