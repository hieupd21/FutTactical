import { beforeEach, describe, expect, it } from "vitest";
import { useUi } from "./uiStore";

const reset = () =>
  useUi.setState({
    currentTab: "central",
    tabStack: [],
    sheet: null,
    ptab: null,
    error: null,
    swapIn: null,
    match: null,
  });

describe("uiStore.goBack", () => {
  beforeEach(reset);

  it("trả false khi không còn gì để lùi", () => {
    expect(useUi.getState().goBack()).toBe(false);
  });

  it("đóng sheet trước khi lùi tab", () => {
    useUi.getState().setTab("squad");
    useUi.getState().openPlayer("p1");
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().sheet).toBeNull();
    expect(useUi.getState().currentTab).toBe("squad");
  });

  it("huỷ chế độ chọn thay người trước khi lùi tab", () => {
    useUi.getState().setTab("squad");
    useUi.getState().setSwapIn("p1");
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().swapIn).toBeNull();
    expect(useUi.getState().currentTab).toBe("squad");
  });

  it("lùi lần lượt qua các tab đã mở", () => {
    const ui = useUi.getState();
    ui.setTab("squad");
    ui.setTab("market");
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().currentTab).toBe("squad");
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().currentTab).toBe("central");
    expect(useUi.getState().goBack()).toBe(false);
  });

  it("không đẩy ngăn xếp khi bấm lại đúng tab đang mở", () => {
    useUi.getState().setTab("central");
    expect(useUi.getState().tabStack).toEqual([]);
  });

  it("từ màn con của Câu lạc bộ lùi về ba khối trước khi lùi tab", () => {
    useUi.getState().setTab("club");
    useUi.getState().setClubView("standings");
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().clubView).toBe("hub");
    expect(useUi.getState().currentTab).toBe("club");
  });

  it("chặn Back khi đang xem trận", () => {
    useUi.getState().setTab("squad");
    useUi.setState({ sheet: { type: "match" } });
    expect(useUi.getState().goBack()).toBe(true);
    expect(useUi.getState().sheet).toEqual({ type: "match" });
    expect(useUi.getState().currentTab).toBe("squad");
  });
});
