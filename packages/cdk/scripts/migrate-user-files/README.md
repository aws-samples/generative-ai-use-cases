# Move files to the per-user layout

From v5.6.0, GenU serves a file only under the prefix of its owner
(`users/<sub>/` in the file bucket). Files stored by earlier versions keep
their earlier keys and are no longer shown. This optional script moves them,
so users find their earlier attachments, generated videos and agent output
files again, and records the owner on share links created before v5.6.0.

## What it does

- A file moves to the prefix of the user whose record points at it: the owner
  of the chat whose message attaches or links it, or the owner of the video
  job. Earlier versions served any key to any signed-in user, so each owner
  keeps what their own chats showed, and no one gains access to a file.
- Files are copied inside S3 with CopyObject. Their contents never reach the
  machine that runs the script. The files at their earlier keys are not
  deleted.
- The records are pointed at the copies: `extraData` and Markdown links and
  images (`[...](url)`, `![...](url)`) in messages, and the `output` of video
  jobs. Other text, such as JSON a user pasted, is left as typed. A record
  that changed after the scan is left alone (run the script again). A record
  whose copy failed is not changed.
- Before it changes a record, it saves the earlier value to a backup file, so
  the migration can be undone (see [Undo](#undo)).
- Running it again is safe: moved files and updated records are skipped.

It does not move, and reports instead:

| Alert               | Meaning                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared-key`        | Chats of more than one user point at the file, so it cannot be tied to one owner. Check them, then run with `--include-shared-keys` to copy the file to each of these users. |
| `unknown-user`      | The owner is no longer in the user pool.                                                                                                                                     |
| `missing-object`    | The record points at a key that is not in the bucket.                                                                                                                        |
| `unsafe-key`        | The key has `.` or `..` segments.                                                                                                                                            |
| `too-large`         | Larger than 5 GB (one CopyObject).                                                                                                                                           |
| `video-in-progress` | The video job has not finished. Run again later. A job that stays in progress for days will not finish.                                                                      |
| `not-a-link`        | A message mentions the file outside a Markdown link (for example, in pasted JSON). The text is left as it is.                                                                |
| `unreferenced`      | No record points at the object, for example audio uploaded for a transcription, or files of deleted chats.                                                                   |

## When to run it

After updating to v5.6.0. Until it runs, earlier files are not shown. Run it
again later if a video job was still running.

## How to run it

Run it without `--apply` first. That only reads the table, the buckets and the
user pool, and writes a report. Check the counts and the alerts, then run the
same command with `--apply`.

```bash
cd packages/cdk
npx ts-node scripts/migrate-user-files/cli.ts \
  --table <DatabaseTable...> \
  --file-bucket <APIFileBucket...> --region <region of the GenU stack> \
  --user-pool-id <AuthUserPool...> \
  --agent-core-bucket <GenericAgentCoreAgentCoreFileBucket...> --agent-core-region <agentCoreRegion>
```

`--agent-core-bucket` is needed only when AgentCore was enabled. The names are
the physical IDs of these resources:

```bash
aws cloudformation list-stack-resources --region <region> \
  --stack-name GenerativeAiUseCasesStack<env> \
  --query 'StackResourceSummaries[?starts_with(LogicalResourceId,`DatabaseTable`)||starts_with(LogicalResourceId,`APIFileBucket`)||starts_with(LogicalResourceId,`AuthUserPool`)].[LogicalResourceId,PhysicalResourceId]'
aws cloudformation list-stack-resources --region <agentCoreRegion> \
  --stack-name AgentCoreStack<env> \
  --query 'StackResourceSummaries[?contains(LogicalResourceId,`AgentCoreFileBucket`)].PhysicalResourceId'
```

The report lists file keys and record keys only. It does not contain message
text or file contents, but file keys include the file names users chose:
store it as you would store access logs.

## Undo

`--apply` writes the earlier value of every record it changes to a backup file
before changing it (`--backup <path>`, by default
`migrate-user-files-<time>-backup.jsonl`; readable only by its owner). It
holds earlier message text: store it as you would store the table, and delete
it once you no longer need to undo.

To put the records back:

```bash
npx ts-node scripts/migrate-user-files/cli.ts \
  --table <DatabaseTable...> --region <region> --restore <backup file>
```

A record changed again after the migration is left alone and listed. Copied
files stay in place; nothing points at them after the restore.

## Permissions

Run it with a role that has only these permissions, so that the run is
recorded in CloudTrail under that role. AWS CloudShell in the account works
and keeps the run inside AWS. The dry run needs only the first statement.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Read",
      "Effect": "Allow",
      "Action": ["dynamodb:Scan", "s3:ListBucket", "cognito-idp:ListUsers"],
      "Resource": [
        "arn:aws:dynamodb:<region>:<account>:table/<table>",
        "arn:aws:s3:::<file bucket>",
        "arn:aws:s3:::<AgentCore bucket>",
        "arn:aws:cognito-idp:<region>:<account>:userpool/<user pool id>"
      ]
    },
    {
      "Sid": "Apply",
      "Effect": "Allow",
      "Action": [
        "dynamodb:UpdateItem",
        "s3:GetObject",
        "s3:GetObjectTagging",
        "s3:PutObject",
        "s3:PutObjectTagging"
      ],
      "Resource": [
        "arn:aws:dynamodb:<region>:<account>:table/<table>",
        "arn:aws:s3:::<file bucket>/*",
        "arn:aws:s3:::<AgentCore bucket>/*"
      ]
    }
  ]
}
```

`s3:GetObject` is needed because CopyObject reads the source on S3's side. The
role can also download the files; limit who can assume it.

## Earlier files

The script never deletes. After checking that users see their files, decide
under your data retention policy whether to delete the objects outside
`users/` in the file bucket and the AgentCore bucket. The report's copies list
the moved ones; the alerts list the rest.
