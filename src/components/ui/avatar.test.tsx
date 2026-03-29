import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

describe("avatar wrapper", () => {
  test("renders fallback content without crashing", async () => {
    const { Avatar, AvatarFallback } = await import("./avatar");

    const html = renderToStaticMarkup(
      <Avatar>
        <AvatarFallback>U</AvatarFallback>
      </Avatar>,
    );

    expect(html).toContain("U");
  });
});
