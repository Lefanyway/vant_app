import { render, screen } from "@testing-library/react-native";
import { WatchOptions, describeStream } from "@/components/WatchOptions";

test("reads platform and channel from the stream link", () => {
  expect(describeStream({ url: "https://www.twitch.tv/valorant_br", language: "pt" })).toEqual({ platform: "twitch", channel: "valorant_br", language: "Português" });
  expect(describeStream({ url: "https://www.youtube.com/@VALORANTEsports" })).toMatchObject({ platform: "youtube", channel: "VALORANTEsports" });
  expect(describeStream({ url: "https://youtu.be/abc" })).toMatchObject({ platform: "youtube", channel: "YouTube" });
});

test("lists the Portuguese broadcast first", () => {
  render(<WatchOptions streams={[{ url: "https://www.twitch.tv/valorant", language: "en", official: true }, { url: "https://www.twitch.tv/gaules", language: "pt" }]} />);
  const links = screen.getAllByRole("link");
  expect(links[0].props.accessibilityLabel).toBe("Assistir em gaules, Twitch");
  expect(screen.getByText("Twitch · Inglês · oficial")).toBeTruthy();
});

test("names Weibo and falls back to Riot's channels for VCT", () => {
  expect(describeStream({ url: "https://weibo.com/7864854446", language: "zh" })).toMatchObject({ platform: "weibo", channel: "Weibo" });
  const { officialStreams } = require("@/components/WatchOptions");
  expect(officialStreams("VCT 2026: Americas Stage 2")[0].url).toBe("https://www.twitch.tv/valorant_br");
  expect(officialStreams("Asia Pacific Predator League")).toEqual([]);
});
