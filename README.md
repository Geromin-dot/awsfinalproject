# Class Announcement Board

A small Next.js project for posting class reminders and schedule updates. The progress-check version lets you post and view announcements and download a sample class reminder. Posts persist across refreshes in the same browser.

## Run locally

Use Node.js 22.

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy the progress-check preview to Vercel

Import this GitHub repository in Vercel and keep the **Next.js** framework preset. No environment variables are needed for this version.

## Progress-check demo

1. Open the board and post an announcement titled **Group presentation reminder**.
2. Refresh the page to show that the post is still there.
3. Download the class reminder.
4. Explain that shared cloud storage is the next milestone. The preview saves posts only in the current browser and uses a built-in sample file.

## Planned cloud deployment

The project brief requires compute, a database, cloud storage, and a networking configuration. Use the row for the provider approved by the instructor.

| Component | If GCP is assigned | If AWS is approved |
| --- | --- | --- |
| Compute | Cloud Run runs the Next.js app | EC2 runs the Next.js app |
| Database | Firestore stores announcements | DynamoDB stores announcements |
| File storage | Cloud Storage holds the reminder | A private S3 bucket holds the reminder |
| Networking | Dedicated VPC subnet with Direct VPC egress | VPC and a security group for the EC2 instance |
| Identity | Cloud Run service account | EC2 instance role |

The same interface can be reused. In the cloud deployment, a Next.js server endpoint will write and read announcements through the database SDK. A second endpoint will return the reminder from the private bucket. Give the compute identity the permissions it needs and keep cloud credentials on the server. Use HTTPS for the deployed app.

For the final demo, show a newly saved post in the cloud database and the reminder object in the cloud bucket. Show the app, compute resource, and network configuration. Create the required architecture diagram manually so it matches the deployed resources.
