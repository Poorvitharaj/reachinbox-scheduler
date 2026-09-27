import {
  useEffect,
  useState,
} from "react";
import type { ChangeEvent } from "react";

import "./App.css";

type User = {
  id: string;
  googleId?: string;
  name: string;
  email: string;
  avatar?: string | null;
};

type Email = {
  id: string;
  sender_email?: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at?: string | null;
  status: string;
  failure_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SlackStatus = {
  connected: boolean;
  slack?: {
    teamName: string;
    channelId: string | null;
    connectedAt: string;
    updatedAt: string;
  };
};

function App() {
  const [activeTab, setActiveTab] =
    useState("compose");

  const [user, setUser] =
    useState<User | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [senderEmail, setSenderEmail] =
    useState("");

  const [recipients, setRecipients] =
    useState<string[]>([]);

  const [recipientInput, setRecipientInput] =
    useState("");

  const [subject, setSubject] =
    useState("");

  const [body, setBody] =
    useState("");

  const [startTime, setStartTime] =
    useState("");

  const [delayBetweenEmails, setDelayBetweenEmails] =
    useState("2000");

  const [hourlyLimit, setHourlyLimit] =
    useState("200");

  const [scheduledEmails, setScheduledEmails] =
    useState<Email[]>([]);

  const [sentEmails, setSentEmails] =
    useState<Email[]>([]);

  const [failedEmails, setFailedEmails] =
    useState<Email[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<Email[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [scheduledLoading, setScheduledLoading] =
    useState(false);

  const [sentLoading, setSentLoading] =
    useState(false);

  const [failedLoading, setFailedLoading] =
    useState(false);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [csvLoading, setCsvLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [slackStatus, setSlackStatus] =
    useState<SlackStatus | null>(null);

  const [slackLoading, setSlackLoading] =
    useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    loadScheduledEmails();
    loadSentEmails();
    loadFailedEmails();
    loadSlackStatus();
  }, [user]);

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("slack") ===
      "connected"
    ) {
      setMessage(
        "Slack connected successfully. Rate-limit notifications are enabled."
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      loadSlackStatus();
    }
  }, []);

  async function checkAuthentication() {
    try {
      const response = await fetch(
        "http://localhost:4000/api/auth/me",
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();

      if (
        data.success &&
        data.user
      ) {
        setUser(data.user);
        setSenderEmail(
          data.user.email
        );
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error(
        "Authentication check failed:",
        error
      );

      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadScheduledEmails() {
    setScheduledLoading(true);

    try {
      const response = await fetch(
        "http://localhost:4000/api/emails/scheduled",
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        setScheduledEmails(
          data.emails
        );
      }
    } catch (error) {
      console.error(
        "Failed to load scheduled emails:",
        error
      );
    } finally {
      setScheduledLoading(false);
    }
  }

  async function loadSentEmails() {
    setSentLoading(true);

    try {
      const response = await fetch(
        "http://localhost:4000/api/emails/sent",
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSentEmails(
          data.emails
        );
      }
    } catch (error) {
      console.error(
        "Failed to load sent emails:",
        error
      );
    } finally {
      setSentLoading(false);
    }
  }

  async function loadFailedEmails() {
    setFailedLoading(true);

    try {
      const response = await fetch(
        "http://localhost:4000/api/emails/failed",
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        setFailedEmails(
          data.emails
        );
      }
    } catch (error) {
      console.error(
        "Failed to load failed emails:",
        error
      );
    } finally {
      setFailedLoading(false);
    }
  }

  async function loadSlackStatus() {
    setSlackLoading(true);

    try {
      const response = await fetch(
        "http://localhost:4000/api/slack/status",
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      if (data.success) {
        setSlackStatus({
          connected:
            data.connected,
          slack: data.slack,
        });
      }
    } catch (error) {
      console.error(
        "Failed to load Slack status:",
        error
      );
    } finally {
      setSlackLoading(false);
    }
  }

  function connectSlack() {
    window.location.href =
      "http://localhost:4000/api/slack/connect";
  }

  function logout() {
    window.location.href =
      "http://localhost:4000/api/auth/logout";
  }

  function addRecipient() {
    const email =
      recipientInput.trim();

    if (!email) {
      return;
    }

    if (!email.includes("@")) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    if (
      recipients.includes(email)
    ) {
      setError(
        "This recipient is already added."
      );
      return;
    }

    setRecipients([
      ...recipients,
      email,
    ]);

    setRecipientInput("");
    setError("");
  }

  function removeRecipient(
    email: string
  ) {
    setRecipients(
      recipients.filter(
        (recipient) =>
          recipient !== email
      )
    );
  }

  async function handleCsvUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setCsvLoading(true);

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    try {
      const response =
        await fetch(
          "http://localhost:4000/api/upload/recipients",
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "CSV upload failed"
        );
      }

      setRecipients(
        data.recipients
      );

      setMessage(
        `${data.count} recipient(s) imported successfully.`
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "CSV upload failed"
      );
    } finally {
      setCsvLoading(false);
      event.target.value = "";
    }
  }

  async function scheduleEmails() {
    setError("");
    setMessage("");

    if (!user) {
      setError(
        "Please sign in with Google before scheduling emails."
      );
      return;
    }

    if (recipients.length === 0) {
      setError(
        "Please add at least one recipient."
      );
      return;
    }

    if (!subject.trim()) {
      setError(
        "Please enter a subject."
      );
      return;
    }

    if (!body.trim()) {
      setError(
        "Please enter the email body."
      );
      return;
    }

    if (!startTime) {
      setError(
        "Please select a start date and time."
      );
      return;
    }

    const parsedDelay =
      Number(
        delayBetweenEmails
      );

    const parsedHourlyLimit =
      Number(hourlyLimit);

    if (
      !Number.isFinite(
        parsedDelay
      ) ||
      parsedDelay < 0
    ) {
      setError(
        "Delay must be 0 or greater."
      );
      return;
    }

    if (
      !Number.isFinite(
        parsedHourlyLimit
      ) ||
      parsedHourlyLimit < 1
    ) {
      setError(
        "Hourly limit must be at least 1."
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "http://localhost:4000/api/emails/schedule",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              senderEmail:
                senderEmail ||
                user.email,

              recipients,

              subject,

              body,

              startTime,

              delayBetweenEmails:
                parsedDelay,

              hourlyLimit:
                parsedHourlyLimit,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to schedule emails"
        );
      }

      setMessage(
        `${data.emails.length} email(s) scheduled successfully.`
      );

      setRecipients([]);
      setSubject("");
      setBody("");

      await loadScheduledEmails();
      await loadSentEmails();
      await loadFailedEmails();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to schedule emails"
      );
    } finally {
      setLoading(false);
    }
  }

  async function searchEmails() {
    const query =
      searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          `http://localhost:4000/api/emails/search?q=${encodeURIComponent(
            query
          )}`,
          {
            credentials: "include",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Search failed"
        );
      }

      if (data.success) {
        setSearchResults(
          data.emails
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Search failed"
      );
    } finally {
      setSearchLoading(false);
    }
  }

  function formatDate(
    date?: string | null
  ) {
    if (!date) {
      return "—";
    }

    return new Date(
      date
    ).toLocaleString();
  }

  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand-icon">
            R
          </div>

          <h1>ReachInbox</h1>

          <p>
            Checking your authentication...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            R
          </div>

          <h1>
            ReachInbox
          </h1>

          <p className="auth-subtitle">
            Email Scheduler
          </p>

          <div className="auth-divider"></div>

          <p className="auth-description">
            Schedule, automate and
            monitor your outbound
            emails from one place.
          </p>

          <a
            className="google-login-button"
            href="http://localhost:4000/api/auth/google"
          >
            <span className="google-icon">
              G
            </span>

            Sign in with Google
          </a>

          <p className="auth-note">
            Secure authentication powered
            by Google OAuth
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            R
          </div>

          <div>
            <h1>
              ReachInbox
            </h1>

            <span>
              Email Scheduler
            </span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="status-pill">
            <span className="status-dot"></span>
            System Online
          </div>

          <div className="user-profile">
            {user.avatar && (
              <img
                src={user.avatar}
                alt="Profile"
              />
            )}

            <div className="user-profile-info">
              <div className="user-profile-name">
                {user.name}
              </div>

              <div className="user-profile-email">
                {user.email}
              </div>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav>
            <button
              className={
                activeTab === "compose"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                setActiveTab(
                  "compose"
                )
              }
            >
              <span>✉</span>
              Compose
            </button>

            <button
              className={
                activeTab === "scheduled"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                setActiveTab(
                  "scheduled"
                )
              }
            >
              <span>◷</span>
              Scheduled
              <strong>
                {
                  scheduledEmails.length
                }
              </strong>
            </button>

            <button
              className={
                activeTab === "sent"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                setActiveTab(
                  "sent"
                )
              }
            >
              <span>✓</span>
              Sent
              <strong>
                {
                  sentEmails.length
                }
              </strong>
            </button>

            <button
              className={
                activeTab === "failed"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                setActiveTab(
                  "failed"
                )
              }
            >
              <span>!</span>
              Failed
              <strong>
                {
                  failedEmails.length
                }
              </strong>
            </button>

            <button
              className={
                activeTab === "search"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                setActiveTab(
                  "search"
                )
              }
            >
              <span>⌕</span>
              Search
            </button>

            <a
              className="nav-item"
              href="http://localhost:4000/admin/queues"
              target="_blank"
              rel="noreferrer"
            >
              <span>▦</span>
              Queue Monitor
            </a>
          </nav>

          <div className="sidebar-bottom">
            <div className="architecture-card">
              <p>
                POWERED BY
              </p>

              <div>
                PostgreSQL · Redis
              </div>

              <div>
                BullMQ · Elasticsearch
              </div>

              <div>
                Node.js · React
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          {activeTab ===
            "compose" && (
            <>
              <div className="page-heading">
                <div>
                  <h2>
                    Create Campaign
                  </h2>

                  <p>
                    Schedule and automate
                    your outbound emails.
                  </p>
                </div>

                <div className="heading-badge">
                  <span></span>
                  Queue ready
                </div>
              </div>

              {message && (
                <div className="alert success">
                  ✓ {message}
                </div>
              )}

              {error && (
                <div className="alert error">
                  ⚠ {error}
                </div>
              )}

              <section className="card">
                <div className="card-header">
                  <div>
                    <h3>
                      Email Details
                    </h3>

                    <p>
                      Configure your
                      message and
                      recipients.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>
                      From
                    </label>

                    <input
                      type="email"
                      value={
                        senderEmail
                      }
                      onChange={(
                        event
                      ) =>
                        setSenderEmail(
                          event.target
                            .value
                        )
                      }
                      placeholder="sender@example.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Subject
                    </label>

                    <input
                      type="text"
                      value={
                        subject
                      }
                      onChange={(
                        event
                      ) =>
                        setSubject(
                          event.target
                            .value
                        )
                      }
                      placeholder="Enter email subject"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Recipients
                  </label>

                  <div className="recipient-input">
                    <input
                      type="email"
                      value={
                        recipientInput
                      }
                      onChange={(
                        event
                      ) =>
                        setRecipientInput(
                          event.target
                            .value
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault();
                          addRecipient();
                        }
                      }}
                      placeholder="recipient@example.com"
                    />

                    <button
                      type="button"
                      onClick={
                        addRecipient
                      }
                    >
                      Add
                    </button>
                  </div>

                  <div className="upload-row">
                    <label className="upload-button">
                      {csvLoading
                        ? "Uploading..."
                        : "📁 Upload CSV"}

                      <input
                        type="file"
                        accept=".csv"
                        disabled={
                          csvLoading
                        }
                        onChange={
                          handleCsvUpload
                        }
                      />
                    </label>

                    <span>
                      CSV must contain
                      an{" "}
                      <b>
                        email
                      </b>{" "}
                      column.
                    </span>
                  </div>

                  {recipients.length >
                    0 && (
                    <div className="recipient-list">
                      {recipients.map(
                        (
                          email
                        ) => (
                          <div
                            className="recipient-chip"
                            key={
                              email
                            }
                          >
                            <span>
                              {
                                email
                              }
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                removeRecipient(
                                  email
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Message
                  </label>

                  <textarea
                    value={
                      body
                    }
                    onChange={(
                      event
                    ) =>
                      setBody(
                        event.target
                          .value
                      )
                    }
                    placeholder="Write your email message..."
                    rows={
                      9
                    }
                  />
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h3>
                      Delivery Settings
                    </h3>

                    <p>
                      Control when
                      and how
                      quickly
                      emails are
                      sent.
                    </p>
                  </div>
                </div>

                <div className="settings-grid">
                  <div className="form-group">
                    <label>
                      Start Date &
                      Time
                    </label>

                    <input
                      type="datetime-local"
                      value={
                        startTime
                      }
                      onChange={(
                        event
                      ) =>
                        setStartTime(
                          event.target
                            .value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Delay Between
                      Emails
                    </label>

                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        value={
                          delayBetweenEmails
                        }
                        onChange={(
                          event
                        ) =>
                          setDelayBetweenEmails(
                            event.target
                              .value
                          )
                        }
                      />

                      <span>
                        ms
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>
                      Hourly Rate
                      Limit
                    </label>

                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="1"
                        value={
                          hourlyLimit
                        }
                        onChange={(
                          event
                        ) =>
                          setHourlyLimit(
                            event.target
                              .value
                          )
                        }
                      />

                      <span>
                        emails / hour
                      </span>
                    </div>
                  </div>
                </div>

                <div className="delivery-info">
                  <div>
                    <span>
                      Recipients
                    </span>

                    <strong>
                      {
                        recipients.length
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Delay
                    </span>

                    <strong>
                      {
                        delayBetweenEmails
                      }{" "}
                      ms
                    </strong>
                  </div>

                  <div>
                    <span>
                      Rate limit
                    </span>

                    <strong>
                      {
                        hourlyLimit
                      }
                      /hr
                    </strong>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h3>
                      Slack
                      Notifications
                    </h3>

                    <p>
                      Receive a Slack
                      notification when
                      the hourly email
                      limit is reached.
                    </p>
                  </div>

                  {slackLoading ? (
                    <span className="heading-badge">
                      Checking...
                    </span>
                  ) : slackStatus?.connected ? (
                    <span className="heading-badge">
                      <span></span>
                      Connected
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={
                        connectSlack
                      }
                    >
                      Connect Slack
                    </button>
                  )}
                </div>

                {slackStatus?.connected &&
                  slackStatus.slack && (
                    <div className="slack-connected">
                      <strong>
                        {
                          slackStatus
                            .slack
                            .teamName
                        }
                      </strong>

                      <span>
                        Rate-limit alerts
                        enabled
                      </span>
                    </div>
                  )}
              </section>

              <div className="action-row">
                <button
                  className="primary-button"
                  onClick={
                    scheduleEmails
                  }
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? "Scheduling..."
                    : "Schedule Campaign →"}
                </button>
              </div>
            </>
          )}

          {activeTab ===
            "scheduled" && (
            <EmailTable
              title="Scheduled Emails"
              description="Emails waiting to be processed by the queue."
              emails={
                scheduledEmails
              }
              emptyMessage="No scheduled emails."
              formatDate={
                formatDate
              }
              loading={
                scheduledLoading
              }
              showSentTime={
                false
              }
            />
          )}

          {activeTab === "sent" && (
            <EmailTable
              title="Sent Emails"
              description="Previously delivered emails."
              emails={
                sentEmails
              }
              emptyMessage="No sent emails yet."
              formatDate={
                formatDate
              }
              loading={
                sentLoading
              }
              showSentTime={
                true
              }
            />
          )}

          {activeTab ===
            "failed" && (
            <EmailTable
              title="Failed Emails"
              description="Emails that could not be delivered."
              emails={
                failedEmails
              }
              emptyMessage="No failed emails."
              formatDate={
                formatDate
              }
              loading={
                failedLoading
              }
              showSentTime={
                false
              }
            />
          )}

          {activeTab ===
            "search" && (
            <>
              <div className="page-heading">
                <div>
                  <h2>
                    Search Emails
                  </h2>

                  <p>
                    Search across
                    subjects,
                    recipients and
                    message content.
                  </p>
                </div>
              </div>

              {error && (
                <div className="alert error">
                  ⚠ {error}
                </div>
              )}

              <section className="card search-card">
                <div className="search-box">
                  <input
                    value={
                      searchQuery
                    }
                    onChange={(
                      event
                    ) =>
                      setSearchQuery(
                        event.target
                          .value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        searchEmails();
                      }
                    }}
                    placeholder="Search emails..."
                  />

                  <button
                    onClick={
                      searchEmails
                    }
                    disabled={
                      searchLoading
                    }
                  >
                    {searchLoading
                      ? "Searching..."
                      : "Search"}
                  </button>
                </div>
              </section>

              {searchLoading ? (
                <div className="empty-state">
                  Searching emails...
                </div>
              ) : searchResults.length >
                0 ? (
                <EmailTable
                  title="Search Results"
                  description={`${searchResults.length} result(s) found.`}
                  emails={
                    searchResults
                  }
                  emptyMessage="No results."
                  formatDate={
                    formatDate
                  }
                  loading={
                    false
                  }
                  showSentTime={
                    true
                  }
                />
              ) : (
                searchQuery && (
                  <div className="empty-state">
                    No matching
                    emails found.
                  </div>
                )
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function EmailTable({
  title,
  description,
  emails,
  emptyMessage,
  formatDate,
  loading,
  showSentTime,
}: {
  title: string;
  description: string;
  emails: Email[];
  emptyMessage: string;
  formatDate: (
    date?: string | null
  ) => string;
  loading: boolean;
  showSentTime: boolean;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h2>{title}</h2>

          <p>
            {description}
          </p>
        </div>

        <div className="count-badge">
          {emails.length} emails
        </div>
      </div>

      <section className="card table-card">
        {loading ? (
          <div className="empty-state">
            Loading emails...
          </div>
        ) : emails.length ===
          0 ? (
          <div className="empty-state">
            {emptyMessage}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>
                    Recipient
                  </th>

                  <th>
                    Subject
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    {showSentTime
                      ? "Sent Time"
                      : "Scheduled"}
                  </th>
                </tr>
              </thead>

              <tbody>
                {emails.map(
                  (email) => (
                    <tr
                      key={
                        email.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            email.recipient_email
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          email.subject
                        }
                      </td>

                      <td>
                        <span
                          className={`status ${email.status.toLowerCase()}`}
                        >
                          {
                            email.status
                          }
                        </span>
                      </td>

                      <td>
                        {showSentTime
                          ? formatDate(
                              email.sent_at
                            )
                          : formatDate(
                              email.scheduled_at
                            )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default App;