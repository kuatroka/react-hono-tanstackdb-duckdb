import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "uplot/dist/uPlot.min.css";
import { ZeroProvider } from "@rocicorp/zero/react";
import { schema, Schema } from "./schema";
import Cookies from "js-cookie";
import { decodeJwt } from "jose";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { formatDate } from "./date";
import { randInt } from "./rand";
import { RepeatButton } from "./repeat-button";
import { randomMessage } from "./test-data";
import { CounterPage } from "./components/CounterPage";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { GlobalNav } from "./components/GlobalNav";
import { UserProfile } from "./pages/UserProfile";
import { AssetsTablePage } from "./pages/AssetsTable";
import { SuperinvestorsTablePage } from "./pages/SuperinvestorsTable";
import { AssetDetailPage } from "./pages/AssetDetail";
import { SuperinvestorDetailPage } from "./pages/SuperinvestorDetail";
import { initZero } from "./zero-client";
import { queries } from "./zero/queries";

// Stable IDs so Zero reuses the same IndexedDB database
function getStableUserID(): string {
  const encodedJWT = Cookies.get("jwt");
  const decodedJWT = encodedJWT && decodeJwt(encodedJWT);
  if (decodedJWT?.sub) return decodedJWT.sub as string;

  const ANON_USER_KEY = "zero_anon_user_id";
  let anonID = localStorage.getItem(ANON_USER_KEY);
  if (!anonID) {
    anonID = `anon_${crypto.randomUUID()}`;
    localStorage.setItem(ANON_USER_KEY, anonID);
  }
  return anonID;
}

function getStableStorageKey(): string {
  const STORAGE_KEY = "zero_storage_key_v2";
  let storageKey = localStorage.getItem(STORAGE_KEY);
  if (!storageKey) {
    storageKey = "main-v2";
    localStorage.setItem(STORAGE_KEY, storageKey);
  }
  return storageKey;
}

async function requestPersistentStorage() {
  if (navigator.storage?.persist) {
    const persisted = await navigator.storage.persisted();
    if (!persisted) await navigator.storage.persist();
  }
}

const encodedJWT = Cookies.get("jwt");
const userID = getStableUserID();
const storageKey = getStableStorageKey();
const server = import.meta.env.VITE_PUBLIC_SERVER ?? "http://localhost:4848";
const auth = encodedJWT;
const getQueriesURL = import.meta.env.VITE_ZERO_GET_QUERIES_URL ?? "http://localhost:4001/api/zero/get-queries";

function AppContent() {
  const z = useZero<Schema>();
  initZero(z);

  // Prevent UI flash on refresh: hide until content is ready
  const [contentReady, setContentReady] = useState(false);
  const onReady = () => setContentReady(true);

  useEffect(() => {
    requestPersistentStorage().catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <div style={{ visibility: contentReady ? 'visible' : 'hidden' }}>
        <GlobalNav />
        <Routes>
          <Route path="/" element={<LandingPage onReady={onReady} />} />
          <Route path="/messages" element={<MessagesPage onReady={onReady} />} />
          <Route path="/counter" element={<CounterPage onReady={onReady} />} />
          <Route path="/assets" element={<AssetsTablePage onReady={onReady} />} />
          <Route path="/assets/:code/:cusip" element={<AssetDetailPage onReady={onReady} />} />
          <Route path="/superinvestors" element={<SuperinvestorsTablePage onReady={onReady} />} />
          <Route path="/superinvestors/:cik" element={<SuperinvestorDetailPage onReady={onReady} />} />
          <Route path="/profile" element={<UserProfile onReady={onReady} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function LandingPage({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col items-center justify-center gap-6 min-h-[60vh]">
          <h1 className="text-4xl font-bold text-center">Welcome to fintellectus</h1>
          <p className="text-lg text-muted-foreground text-center max-w-2xl">
            Your gateway to superinvestor insights and asset analysis.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessagesPage({ onReady }: { onReady: () => void }) {
  const z = useZero<Schema>();

  const [users, usersResult] = useQuery(queries.listUsers());
  const [mediums] = useQuery(queries.listMediums());

  // Signal ready when data is available (from cache or server)
  useEffect(() => {
    if (users.length > 0 || usersResult.type === 'complete') {
      onReady();
    }
  }, [users.length, usersResult.type, onReady]);

  const [filterUser, setFilterUser] = useState("");
  const [filterText, setFilterText] = useState("");

  const [allMessages] = useQuery(queries.messagesFeed(null, ""));
  const [filteredMessages] = useQuery(
    queries.messagesFeed(filterUser || null, filterText),
    { ttl: "none" }
  );

  const hasFilters = filterUser || filterText;

  if (!users.length || !mediums.length) {
    return null;
  }

  const viewer = users.find((user) => user.id === z.userID);

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col gap-6">
          <header className="flex justify-between items-center flex-wrap gap-4">
            <h1 className="text-3xl font-bold">Messages</h1>
            <div className="flex items-center gap-4">
              <ThemeSwitcher />
              {viewer && (
                <span className="text-sm">
                  Logged in as <strong>{viewer.name}</strong>
                </span>
              )}
              {viewer ? (
                <button
                  className="btn btn-sm btn-outline"
                  onMouseDown={() => {
                    Cookies.remove("jwt");
                    location.reload();
                  }}
                >
                  Logout
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  onMouseDown={() => {
                    fetch("/api/login")
                      .then(() => {
                        location.reload();
                      })
                      .catch((error) => {
                        alert(`Failed to login: ${error.message}`);
                      });
                  }}
                >
                  Login
                </button>
              )}
            </div>
          </header>

          <div className="flex flex-wrap gap-4 items-center">
            <RepeatButton
              onTrigger={() => {
                z.mutate.message.insert(randomMessage(users, mediums));
              }}
            >
              Add Messages
            </RepeatButton>
            <RepeatButton
              onTrigger={(e) => {
                if (!viewer && !e.shiftKey) {
                  alert(
                    "You must be logged in to delete. Hold shift to try anyway."
                  );
                  return false;
                }
                if (allMessages.length === 0) {
                  return false;
                }

                const index = randInt(allMessages.length);
                z.mutate.message.delete({ id: allMessages[index].id });
                return true;
              }}
            >
              Remove Messages
            </RepeatButton>
            <span className="text-sm italic opacity-70">
              (hold down buttons to repeat)
            </span>
          </div>

          <div className="flex justify-center">
            <Link to="/counter" className="btn btn-primary">
              View Counter & Charts →
            </Link>
          </div>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="card-title">Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">From:</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    onChange={(e) => setFilterUser(e.target.value)}
                  >
                    <option value="">All Senders</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Contains:</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search message text..."
                    className="input input-bordered w-full"
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
              </div>
              <div className="text-sm italic opacity-70 mt-2">
                {!hasFilters ? (
                  <>Showing all {filteredMessages.length} messages</>
                ) : (
                  <>
                    Showing {filteredMessages.length} of {allMessages.length}{" "}
                    messages. Try opening{" "}
                    <a href="/" target="_blank" className="link link-primary">
                      another tab
                    </a>{" "}
                    to see them all!
                  </>
                )}
              </div>
            </div>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-2xl italic opacity-70">No posts found 😢</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Sender</th>
                    <th>Medium</th>
                    <th>Message</th>
                    <th>Labels</th>
                    <th>Sent</th>
                    <th>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessages.map((message) => (
                    <tr key={message.id}>
                      <td>{message.sender?.name}</td>
                      <td>{message.medium?.name}</td>
                      <td>{message.body}</td>
                      <td>{message.labels.join(", ")}</td>
                      <td>{formatDate(message.timestamp)}</td>
                      <td
                        className="cursor-pointer hover:text-primary"
                        onMouseDown={(e) => {
                          if (message.senderID !== z.userID && !e.shiftKey) {
                            alert(
                              "You aren't logged in as the sender of this message. Editing won't be permitted. Hold the shift key to try anyway."
                            );
                            return;
                          }

                          const body = prompt("Edit message", message.body);
                          if (body === null) {
                            return;
                          }
                          z.mutate.message.update({
                            id: message.id,
                            body,
                          });
                        }}
                      >
                        ✏️
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ZeroProvider
      {...{
        userID,
        auth,
        server,
        schema,
        storageKey,
        getQueriesURL,
      }}
    >
      <AppContent />
    </ZeroProvider>
  </StrictMode>
);
