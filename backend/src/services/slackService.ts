import dotenv from "dotenv";

dotenv.config();

type SlackConnection = {
  accessToken: string;
  channelId: string | null;
};

export async function exchangeSlackCode(code: string) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Slack OAuth environment variables are not configured"
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(
    "https://slack.com/api/oauth.v2.access",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      `Slack OAuth failed: ${
        data.error || "unknown_error"
      }`
    );
  }

  return {
    accessToken: data.access_token as string,
    teamId:
      (data.team?.id as string) || "",
    teamName:
      (data.team?.name as string) || "",
    slackUserId:
      (data.authed_user?.id as string) || "",
  };
}

export async function getSlackConnection(
  userId: string
): Promise<SlackConnection | null> {
  const result = await import("../config/database").then(
    ({ pool }) =>
      pool.query(
        `
        SELECT
          access_token,
          channel_id
        FROM slack_connections
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId]
      )
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    accessToken:
      result.rows[0].access_token,
    channelId:
      result.rows[0].channel_id,
  };
}

export async function sendSlackNotification(
  userId: string,
  message: string
) {
  const connection =
    await getSlackConnection(userId);

  if (!connection) {
    console.log(
      "ℹ️ Slack is not connected for user:",
      userId
    );

    return {
      success: false,
      reason: "SLACK_NOT_CONNECTED",
    };
  }

  if (!connection.channelId) {
    console.log(
      "ℹ️ Slack channel is not configured for user:",
      userId
    );

    return {
      success: false,
      reason: "SLACK_CHANNEL_NOT_CONFIGURED",
    };
  }

  const response = await fetch(
    "https://slack.com/api/chat.postMessage",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${connection.accessToken}`,
        "Content-Type":
          "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: connection.channelId,
        text: message,
      }),
    }
  );

  const data = await response.json();

  if (!data.ok) {
    console.error(
      "❌ Slack message failed:",
      data.error
    );

    return {
      success: false,
      reason: data.error || "SLACK_MESSAGE_FAILED",
    };
  }

  console.log(
    "📣 Slack notification sent successfully"
  );

  return {
    success: true,
  };
}