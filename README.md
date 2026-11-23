# Class Board

Students can read announcements, filter by category, see pinned updates first, and download PDFs. The teacher dashboard supports password sign-in, publishing, editing, deleting, pinning, and attaching one PDF of up to 2 MiB.

## Run the full local demo

Use Node.js 22. Run `npm install` if dependencies are missing, then run `npm run demo`. Open http://localhost:3100 and use the teacher password printed in your terminal. Posts and attachments are shared across browsers using the same local server and are stored in the ignored `.board-data` folder. The first launch includes editable sample posts. The teacher password changes on restart.

With no server configuration, the app displays a read-only sample board suitable for a Vercel preview.

## Deploy to AWS

The template requires an AWS account with permission to create the listed resources. Review the expected EC2, public IPv4, EBS, DynamoDB backup, and S3 charges before launching.

1. Create a CloudFormation stack using [deploy/board-stack.yml](deploy/board-stack.yml). Acknowledge IAM resource creation. Wait for `CREATE_COMPLETE` and record the stack outputs.
2. Point a DNS hostname at the EC2 public IPv4 address. The IPv4 can change after a stop/start. Connect to the instance through Systems Manager Session Manager.
3. Install Node.js 22, git, and AWS CLI v2 if missing. Copy or clone this repository onto the instance, and run `npm install` and `npm run build`. Use the instance role for AWS authentication. Confirm it can read the table with `aws dynamodb scan --table-name YOUR_TABLE --max-items 1`.
4. Start Next.js as an unprivileged user via systemd. Bind the app to `127.0.0.1:3000` using `npm run start -- --hostname 127.0.0.1 --port 3000`. Set the service working directory to the repo and use a root-only service EnvironmentFile with the following values.

```dotenv
BOARD_STORAGE=aws
BOARD_ORIGIN=https://board.example.org
BOARD_TABLE=YourStackTableOutput
BOARD_BUCKET=YourStackBucketOutput
BOARD_TEACHER_PASSWORD=replace-with-a-long-random-password
BOARD_SESSION_SECRET=replace-with-an-independent-random-secret
```

5. Install Caddy and use the same DNS hostname as `BOARD_ORIGIN` in the Caddyfile.

```caddyfile
board.example.org {
    reverse_proxy 127.0.0.1:3000
}
```

6. Verify HTTPS. Sign in and post a test announcement with a PDF, open the board in a fresh browser, download the attachment, and verify the record in DynamoDB and PDF in S3. Capture the AWS console evidence and manually draw the rubric's architecture diagram from your deployed resources.

The small classroom feed uses a DynamoDB scan. Anyone with the board URL can read announcements and their attached PDFs. After grading, retain any evidence/data you need, empty the stack's S3 bucket, and delete the stack if you no longer need the resources.
