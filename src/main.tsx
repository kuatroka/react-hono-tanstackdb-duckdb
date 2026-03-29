import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "uplot/dist/uPlot.min.css";
import { ZeroProvider } from "@rocicorp/zero/react";
import { schema, Schema } from "./schema";
import Cookies from "js-cookie";
import { decodeJwt } from "jose";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { formatDate } from "./date";
import { randInt } from "./rand";
import { RepeatButton } from "./repeat-button";
import { randomMessage } from "./test-data";
import { CounterPage } from "@/components/CounterPage";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { GlobalNav } from "@/components/GlobalNav";
import { UserProfile } from "@/pages/UserProfile";
import { AssetsTablePage } from "@/pages/AssetsTable";
import { SuperinvestorsTablePage } from "@/pages/SuperinvestorsTable";
import { AssetDetailPage } from "@/pages/AssetDetail";
import { SuperinvestorDetailPage } from "@/pages/SuperinvestorDetail";
import { initZero } from "./zero-client";
import { queries } from "./zero/queries";
import { LatencyBadge } from "@/components/LatencyBadge";
import { useLatencyMs } from "./lib/latency";
import { RouterNavigationBridge } from "./lib/navigation";
import { getRuntimeConfig } from "./runtime-config";

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
const runtimeConfig = getRuntimeConfig();
const server = runtimeConfig.zeroPublicUrl;
const auth = encodedJWT;
const getQueriesURL = runtimeConfig.zeroGetQueriesUrl;

function AppContent() {
  const z = useZero<Schema>();
  initZero(z);

  const onReady = useCallback(() => {}, []);

  useEffect(() => {
    requestPersistentStorage().catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <RouterNavigationBridge />
      <div>
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to fintellectus</h1>
      <p className="text-lg text-muted-foreground max-w-md">
        Your gateway to superinvestor insights and asset analysis.
      </p>
    </div>
  );
}

function MessagesPage({ onReady }: { onReady: () => void }) {
  const z = useZero<Schema>();

  const [users, usersResult] = useQuery(queries.listUsers());
  const [mediums, mediumsResult] = useQuery(queries.listMediums());

  // Signal ready when data is available (from cache or server)
  useEffect(() => {
    if (users.length > 0 || usersResult.type === 'complete') {
      onReady();
    }
  }, [users.length, usersResult.type, onReady]);

  const [filterUser, setFilterUser] = useState("");
  const [filterText, setFilterText] = useState("");

  const [allMessages, allMessagesResult] = useQuery(queries.messagesFeed(null, ""));
  const [filteredMessages, filteredMessagesResult] = useQuery(
    queries.messagesFeed(filterUser || null, filterText),
    { ttl: "none" }
  );

  const directoryReady = Boolean(
    (users.length > 0 || usersResult.type === "complete") &&
      (mediums.length > 0 || mediumsResult.type === "complete")
  );
  const directoryLatencyMs = useLatencyMs({
    isReady: directoryReady,
    resetKey: "messages:directory",
  });

  const feedReady = Boolean(
    filteredMessages.length > 0 ||
      allMessages.length > 0 ||
      (filteredMessagesResult.type === "complete" && allMessagesResult.type === "complete")
  );
  const feedLatencyMs = useLatencyMs({
    isReady: feedReady,
    resetKey: `messages:feed:${filterUser}:${filterText}`,
  });

  const hasFilters = filterUser || filterText;

  if (!users.length || !mediums.length) {
    return null;
  }

  const viewer = users.find((user) => user.id === z.userID);

  return (
    <div className="w-full px-4 py-8 mx-auto">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
            <LatencyBadge ms={feedLatencyMs} source="Zero: messages.feed" />
            <LatencyBadge ms={directoryLatencyMs} source="Zero: users.list + mediums.list" />
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            {viewer && (
              <span className="text-sm text-muted-foreground">
                Logged in as <strong className="text-foreground">{viewer.name}</strong>
              </span>
            )}
            {viewer ? (
              <Button
                variant="outline"
                size="sm"
                onMouseDown={() => {
                  Cookies.remove("jwt");
                  location.reload();
                }}
              >
                Logout
              </Button>
            ) : (
              <Button
                size="sm"
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
              </Button>
            )}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-4">
          <RepeatButton
            onTrigger={() => {
              z.mutate.message.insert(randomMessage(users, mediums));
            }}
          >
            Add Messages
          </RepeatButton>
          <RepeatButton
            variant="secondary"
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
          <span className="text-sm italic text-muted-foreground">
            (hold down buttons to repeat)
          </span>
        </div>

        <div className="flex justify-center">
          <Button asChild>
            <Link to="/counter">View Counter & Charts →</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter the shared message feed by sender or message content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">From</label>
                <Select onValueChange={setFilterUser} value={filterUser || "__all__"}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Senders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Senders</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Contains</label>
                <Input
                  type="text"
                  placeholder="Search message text..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
              </div>
            </div>
            <div className="text-sm italic text-muted-foreground">
              {!hasFilters ? (
                <>Showing all {filteredMessages.length} messages</>
              ) : (
                <>
                  Showing {filteredMessages.length} of {allMessages.length}{" "}
                  messages. Try opening{" "}
                  <a
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    another tab
                  </a>{" "}
                  to see them all!
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {filteredMessages.length === 0 ? (
          <div className="py-12 text-center">
            <h3 className="text-2xl italic text-muted-foreground">No posts found 😢</h3>
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sender</TableHead>
                  <TableHead>Medium</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Labels</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>{message.sender?.name}</TableCell>
                    <TableCell>{message.medium?.name}</TableCell>
                    <TableCell>{message.body}</TableCell>
                    <TableCell>{message.labels.join(", ")}</TableCell>
                    <TableCell>{formatDate(message.timestamp)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="cursor-pointer text-primary underline-offset-4 hover:underline"
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
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
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
);
