import { useEffect, useState } from "react";
import "./App.css";

type Email = {
  id: string;
  sender_email?: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at?: string;
  status: string;
  created_at?: string;
};

function App() {
  const [activeTab, setActiveTab] = useState("compose");

  const [user, setUser] = useState<any>(null);

  const [senderEmail, setSenderEmail] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [startTime, setStartTime] = useState("");

  const [delayBetweenEmails, setDelayBetweenEmails] =
    useState("2000");

  const [hourlyLimit, setHourlyLimit] =
    useState("200");

  const [scheduledEmails, setScheduledEmails] =
    useState<Email[]>([]);

  const [sentEmails, setSentEmails] =
    useState<Email[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<Email[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (user) {
      loadScheduledEmails();
      loadSentEmails();
    }
  }, [user]);

  async function checkAuthentication() {
    try {
      const response = await fetch(
        "http://localhost:4000/api/auth/me",
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setSenderEmail(data.user.email);
      }
    } catch (error) {
      console.error(
        "Authentication check failed:",
        error
      );
    }
  }

  async function loadScheduledEmails() {
    try {
      const response = await fetch(
        "http://localhost:4000/api/emails/scheduled",
        {
          credentials: "include",
        }
      );

      if (response.status === 401) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        setScheduledEmails(data.emails);
      }
    } catch (error) {
      console.error(
        "Failed to load scheduled emails:",
        error
      );
    }
  }

  async function loadSentEmails() {
    try {
      const response = await fetch(
        "http://localhost:4000/api/emails/sent",
        {
          credentials: "include",
        }
      );

      if (response.status === 401) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSentEmails(data.emails);
      }
    } catch (error) {
      console.error(
        "Failed to load sent emails:",
        error
      );
    }
  }

  function addRecipient() {
    const email = recipientInput.trim();

    if (!email) {
      return;
    }

    if (!email.includes("@")) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    if (recipients.includes(email)) {
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

  function removeRecipient(email: string) {
    setRecipients(
      recipients.filter(
        (recipient) => recipient !== email
      )
    );
  }

  async function handleCsvUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    const formData = new FormData();

    formData.append("file", file);

    try {
      const response = await fetch(
        "http://localhost:4000/api/upload/recipients",
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "CSV upload failed"
        );
      }

      setRecipients(data.recipients);

      setMessage(
        `${data.count} recipient(s) imported successfully.`
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "CSV upload failed"
      );
    }

    event.target.value = "";
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

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:4000/api/emails/schedule",
        {
          method: "POST",

          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            senderEmail:
              senderEmail ||
              user.email,

            recipients,

            subject,

            body,

            startTime,

            delayBetweenEmails:
              Number(delayBetweenEmails),

            hourlyLimit:
              Number(hourlyLimit),
          }),
        }
      );

      const data = await response.json();

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
      setRecipientInput("");
      setSubject("");
      setBody("");
      setStartTime("");

      await loadScheduledEmails();
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
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:4000/api/emails/search?q=${encodeURIComponent(
          searchQuery
        )}`,
        {
          credentials: "include",
        }
      );

      if (response.status === 401) {
        setError(
          "Please sign in before searching emails."
        );
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSearchResults(data.emails);
      }
    } catch (error) {
      console.error(
        "Search failed:",
        error
      );

      setError(
        "Failed to search emails."
      );
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            R
          </div>

          <div>
            <h1>ReachInbox</h1>

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

          {user ? (
            <div className="user-profile">
              {user.avatar && (
                <img
                  src={user.avatar}
                  alt="Profile"
                />
              )}

              <span>
                {user.name}
              </span>
            </div>
          ) : (
            <a
              className="google-button"
              href="http://localhost:4000/api/auth/google"
            >
              Sign in with Google
            </a>
          )}
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
                setActiveTab("compose")
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
                setActiveTab("scheduled")
              }
            >
              <span>◷</span>

              Scheduled

              <strong>
                {scheduledEmails.length}
              </strong>
            </button>

            <button
              className={
                activeTab === "sent"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                setActiveTab("sent")
              }
            >
              <span>✓</span>

              Sent

              <strong>
                {sentEmails.length}
              </strong>
            </button>

            <button
              className={
                activeTab === "search"
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                setActiveTab("search")
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
              <p>POWERED BY</p>

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
          {activeTab === "compose" && (
            <>
              <div className="page-heading">
                <div>
                  <h2>
                    Create Campaign
                  </h2>

                  <p>
                    Schedule and automate your
                    outbound emails.
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
                      Configure your message and
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
                      value={senderEmail}
                      onChange={(event) =>
                        setSenderEmail(
                          event.target.value
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
                      value={subject}
                      onChange={(event) =>
                        setSubject(
                          event.target.value
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
                      onChange={(event) =>
                        setRecipientInput(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
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
                      📁 Upload CSV

                      <input
                        type="file"
                        accept=".csv"
                        onChange={
                          handleCsvUpload
                        }
                      />
                    </label>

                    <span>
                      CSV must contain an
                      <b> email </b>
                      column.
                    </span>
                  </div>

                  {recipients.length >
                    0 && (
                    <div className="recipient-list">
                      {recipients.map(
                        (email) => (
                          <div
                            className="recipient-chip"
                            key={email}
                          >
                            <span>
                              {email}
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
                    value={body}
                    onChange={(event) =>
                      setBody(
                        event.target.value
                      )
                    }
                    placeholder="Write your email message..."
                    rows={9}
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
                      Control when and how quickly
                      emails are sent.
                    </p>
                  </div>
                </div>

                <div className="settings-grid">
                  <div className="form-group">
                    <label>
                      Start Date & Time
                    </label>

                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(event) =>
                        setStartTime(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Delay Between Emails
                    </label>

                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        value={
                          delayBetweenEmails
                        }
                        onChange={(event) =>
                          setDelayBetweenEmails(
                            event.target.value
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
                      Hourly Rate Limit
                    </label>

                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="1"
                        value={
                          hourlyLimit
                        }
                        onChange={(event) =>
                          setHourlyLimit(
                            event.target.value
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
                      {recipients.length}
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
                      {hourlyLimit}/hr
                    </strong>
                  </div>
                </div>
              </section>

              <div className="action-row">
                <button
                  className="primary-button"
                  onClick={
                    scheduleEmails
                  }
                  disabled={
                    loading || !user
                  }
                >
                  {loading
                    ? "Scheduling..."
                    : !user
                    ? "Sign in to Schedule"
                    : "Schedule Campaign →"}
                </button>
              </div>
            </>
          )}

          {activeTab === "scheduled" && (
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
            />
          )}

          {activeTab === "sent" && (
            <EmailTable
              title="Sent Emails"
              description="Previously delivered emails."
              emails={sentEmails}
              emptyMessage="No sent emails yet."
              formatDate={
                formatDate
              }
            />
          )}

          {activeTab === "search" && (
            <>
              <div className="page-heading">
                <div>
                  <h2>
                    Search Emails
                  </h2>

                  <p>
                    Search across subjects,
                    recipients and message
                    content.
                  </p>
                </div>
              </div>

              <section className="card search-card">
                <div className="search-box">
                  <input
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
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
                  >
                    Search
                  </button>
                </div>
              </section>

              {searchResults.length >
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
                />
              ) : (
                searchQuery && (
                  <div className="empty-state">
                    No matching emails
                    found.
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
}: {
  title: string;
  description: string;
  emails: Email[];
  emptyMessage: string;
  formatDate: (
    date: string
  ) => string;
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
        {emails.length === 0 ? (
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
                    Scheduled
                  </th>
                </tr>
              </thead>

              <tbody>
                {emails.map(
                  (email) => (
                    <tr
                      key={email.id}
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
                          className={`status ${
                            email.status.toLowerCase()
                          }`}
                        >
                          {
                            email.status
                          }
                        </span>
                      </td>

                      <td>
                        {formatDate(
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