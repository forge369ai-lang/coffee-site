// Year in footer
document.getElementById("year").textContent = new Date().getFullYear();

// Mobile menu
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("nav");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "Close" : "Menu";
});
nav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Menu";
  })
);

// Open now / closed, in South African time.
// Keep these in sync with the hours table in index.html. [open, close] in 24h, null = closed.
const HOURS = {
  0: null,              // Sunday
  1: ["08:30", "18:00"],
  2: ["08:30", "18:00"],
  3: ["08:30", "18:00"],
  4: ["08:30", "18:00"],
  5: ["08:30", "18:00"],
  6: ["08:00", "14:00"], // Saturday
};

(function showOpenStatus() {
  const el = document.getElementById("today");
  if (!el) return;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const now = get("hour") + ":" + get("minute");

  // Highlight today's row
  const rows = document.querySelectorAll(".hours tbody tr");
  const rowIndex = day === 0 ? 2 : day === 6 ? 1 : 0;
  rows[rowIndex]?.classList.add("is-today");

  const h = HOURS[day];
  if (h && now >= h[0] && now < h[1]) {
    el.textContent = `Open now, until ${h[1]}.`;
  } else if (h && now < h[0]) {
    el.textContent = `Closed now. Opens today at ${h[0]}.`;
  } else {
    let next = (day + 1) % 7;
    while (!HOURS[next]) next = (next + 1) % 7;
    const name = next === (day + 1) % 7 ? "tomorrow" :
      ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][next];
    el.textContent = `Closed now. Opens ${name} at ${HOURS[next][0]}.`;
  }
})();
