import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  node:
    process.env.ELASTICSEARCH_URL ||
    "http://localhost:9200",
});

const INDEX_NAME = "emails";

export async function initializeElasticsearch() {
  try {
    const exists =
      await client.indices.exists({
        index: INDEX_NAME,
      });

    if (!exists) {
      await client.indices.create({
        index: INDEX_NAME,

        mappings: {
          properties: {
            emailId: {
              type: "keyword",
            },

            userId: {
              type: "keyword",
            },

            senderEmail: {
              type: "keyword",
            },

            recipientEmail: {
              type: "keyword",
            },

            subject: {
              type: "text",
            },

            body: {
              type: "text",
            },

            status: {
              type: "keyword",
            },

            scheduledAt: {
              type: "date",
            },

            sentAt: {
              type: "date",
            },

            createdAt: {
              type: "date",
            },
          },
        },
      });

      console.log(
        "✅ Elasticsearch index created"
      );
    } else {
      console.log(
        "✅ Elasticsearch index already exists"
      );
    }
  } catch (error) {
    console.error(
      "❌ Elasticsearch initialization failed:",
      error
    );
  }
}

export async function indexEmail(email: {
  emailId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date | string;
  sentAt?: Date | string | null;
  createdAt?: Date | string | null;
}) {
  try {
    await client.index({
      index: INDEX_NAME,

      id: email.emailId,

      document: {
        emailId: email.emailId,

        userId: email.userId,

        senderEmail:
          email.senderEmail,

        recipientEmail:
          email.recipientEmail,

        subject: email.subject,

        body: email.body,

        status: email.status,

        scheduledAt:
          email.scheduledAt,

        sentAt:
          email.sentAt || null,

        createdAt:
          email.createdAt || null,
      },

      refresh: true,
    });

    console.log(
      "🔎 Email indexed in Elasticsearch:",
      email.emailId
    );
  } catch (error) {
    console.error(
      "❌ Failed to index email:",
      error
    );
  }
}

export async function updateEmailStatus(
  emailId: string,
  status: string,
  sentAt?: Date | string | null
) {
  try {
    await client.update({
      index: INDEX_NAME,

      id: emailId,

      doc: {
        status,

        sentAt:
          sentAt || null,
      },

      refresh: true,
    });

    console.log(
      `🔎 Elasticsearch updated: ${emailId} → ${status}`
    );
  } catch (error) {
    console.error(
      "❌ Failed to update Elasticsearch email:",
      error
    );
  }
}

export async function searchEmails(
  userId: string,
  query: string
) {
  const result =
    await client.search({
      index: INDEX_NAME,

      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,

                fields: [
                  "senderEmail",
                  "recipientEmail",
                  "subject",
                  "body",
                  "status",
                ],
              },
            },
          ],

          filter: [
            {
              term: {
                userId,
              },
            },
          ],
        },
      },

      sort: [
        {
          createdAt: {
            order: "desc",
          },
        },
      ],
    });

  return result.hits.hits.map(
    (hit) => hit._source
  );
}