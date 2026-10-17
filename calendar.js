(() => {
  const title = document.getElementById("calendarTitle");
  const calendar = document.getElementById("calendarViewContainer");
  const viewSelect = document.getElementById("calendarView");
  const searchInput = document.getElementById("calendarSearch");
  const dialog = document.getElementById("calendarDialog");
  const form = document.getElementById("calendarEventForm");
  const formTitle = document.getElementById("calendarDialogTitle");
  const titleInput = document.getElementById("calendarEventTitle");
  const dateInput = document.getElementById("calendarEventDate");
  const timeInput = document.getElementById("calendarEventTime");
  const allDayInput = document.getElementById("calendarEventAllDay");
  const categoryInput = document.getElementById("calendarEventCategory");
  const colorInput = document.getElementById("calendarEventColor");
  const descriptionInput = document.getElementById("calendarEventDescription");
  const reminderAtEventInput = document.getElementById("calendarReminderAtEvent");
  const reminderDayBeforeInput = document.getElementById("calendarReminderDayBefore");
  const reminderRepeatInput = document.getElementById("calendarReminderRepeat");
  const reminderIntervalInput = document.getElementById("calendarReminderInterval");
  const reminderUnitInput = document.getElementById("calendarReminderUnit");
  const reminderCountInput = document.getElementById("calendarReminderCount");
  const repeatSettings = document.getElementById("calendarRepeatSettings");
  const deleteButton = document.getElementById("calendarDelete");
  const formError = document.getElementById("calendarFormError");
  const emptySearchMessage = document.getElementById("calendarSearchEmpty");
  const observanceToggle = document.getElementById("calendarShowObservances");
  const pakistanHolidayToggle = document.getElementById("calendarShowPakistanHolidays");
  const userOptions = document.getElementById("calendarUserOptions");
  const shareStatus = document.getElementById("calendarShareStatus");

  if (!title || !calendar || !dialog || !form || !observanceToggle || !pakistanHolidayToggle || !colorInput || !userOptions || !shareStatus || !reminderAtEventInput || !reminderDayBeforeInput || !reminderRepeatInput || !reminderIntervalInput || !reminderUnitInput || !reminderCountInput || !repeatSettings) return;

  const displayedDate = new Date();
  let events = [];
  let cloudEvents = [];
  let localEvents = [];
  let editingEventId = null;
  let availableUsers = [];
  let shareUsersLoaded = false;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const categoryNames = {
    work: "Work",
    travel: "Travel",
    ticket: "Make / Issue Ticket",
    "ticket-refund": "Ticket Refund",
    "vendor-payment": "Pay to Vendor",
    recovery: "Recovery / Payment Collection",
    flight: "Flight Departure",
    visa: "Visa Processing / Expiry",
    hotel: "Hotel Booking / Check-in",
    umrah: "Umrah / Hajj",
    "client-meeting": "Client Meeting",
    "document-expiry": "Passport / Document Expiry",
    "follow-up": "Customer Follow-up",
    personal: "Personal",
    reminder: "Reminder",
    international: "International observance",
    pakistan: "Pakistan national holiday",
  };
  const userScope = [localStorage.getItem("companyid"), localStorage.getItem("uid")]
    .filter(Boolean)
    .join("-");
  const storageKey = `imamCalendarEvents:${userScope || "default"}`;
  const companyId = localStorage.getItem("companyid") || "";
  const currentUid = localStorage.getItem("uid") || "";
  const currentRole = (localStorage.getItem("role") || "").trim().toLowerCase();
  const currentUsername = localStorage.getItem("username") || "User";
  const currentUserKey = `${currentRole}_${currentUid}`;
  const firebase = window.calendarFirebase;
  const calendarCompanyKey = encodeURIComponent(companyId).replace(/\./g, "%2E");
  let unsubscribeEvents = null;
  const fixedObservances = [
    ["01-01", "New Year's Day"],
    ["01-04", "World Braille Day"],
    ["01-24", "International Day of Education"],
    ["02-04", "World Cancer Day"],
    ["02-11", "International Day of Women and Girls in Science"],
    ["02-13", "World Radio Day"],
    ["02-20", "World Day of Social Justice"],
    ["02-21", "International Mother Language Day"],
    ["03-03", "World Wildlife Day"],
    ["03-08", "International Women's Day"],
    ["03-20", "International Day of Happiness"],
    ["03-21", "International Day of Forests"],
    ["03-22", "World Water Day"],
    ["03-23", "World Meteorological Day"],
    ["03-24", "World Tuberculosis Day"],
    ["04-02", "World Autism Awareness Day"],
    ["04-04", "International Day for Mine Awareness"],
    ["04-07", "World Health Day"],
    ["04-22", "International Mother Earth Day"],
    ["04-23", "World Book and Copyright Day"],
    ["04-25", "World Malaria Day"],
    ["04-26", "World Intellectual Property Day"],
    ["04-29", "International Dance Day"],
    ["05-01", "International Workers' Day"],
    ["05-03", "World Press Freedom Day"],
    ["05-15", "International Day of Families"],
    ["05-20", "World Bee Day"],
    ["05-21", "World Day for Cultural Diversity"],
    ["05-22", "International Day for Biological Diversity"],
    ["05-31", "World No Tobacco Day"],
    ["06-05", "World Environment Day"],
    ["06-08", "World Oceans Day"],
    ["06-12", "World Day Against Child Labour"],
    ["06-14", "World Blood Donor Day"],
    ["06-17", "World Day to Combat Desertification"],
    ["06-20", "World Refugee Day"],
    ["06-21", "International Day of Yoga"],
    ["06-26", "International Day Against Drug Abuse"],
    ["07-11", "World Population Day"],
    ["07-18", "Nelson Mandela International Day"],
    ["07-30", "International Day of Friendship"],
    ["08-12", "International Youth Day"],
    ["09-08", "International Literacy Day"],
    ["09-15", "International Day of Democracy"],
    ["09-16", "International Day for the Preservation of the Ozone Layer"],
    ["09-21", "International Day of Peace"],
    ["09-27", "World Tourism Day"],
    ["10-01", "International Day of Older Persons"],
    ["10-02", "International Day of Non-Violence"],
    ["10-05", "World Teachers' Day"],
    ["10-10", "World Mental Health Day"],
    ["10-16", "World Food Day"],
    ["10-24", "United Nations Day"],
    ["11-14", "World Diabetes Day"],
    ["11-16", "International Day for Tolerance"],
    ["11-20", "World Children's Day"],
    ["11-25", "International Day for the Elimination of Violence against Women"],
    ["12-01", "World AIDS Day"],
    ["12-03", "International Day of Persons with Disabilities"],
    ["12-05", "International Volunteer Day"],
    ["12-10", "Human Rights Day"],
    ["12-18", "International Migrants Day"],
    ["12-25", "Christmas Day"],
  ];
  const fixedPakistanHolidays = [
    ["02-05", "Kashmir Solidarity Day"],
    ["03-23", "Pakistan Day"],
    ["05-01", "Labour Day"],
    ["05-28", "Youm-e-Takbeer"],
    ["08-14", "Independence Day"],
    ["11-09", "Iqbal Day"],
    ["12-25", "Quaid-e-Azam Day"],
    ["12-25", "Christmas Day (Pakistan)"],
  ];
  const hijriDateFormatter = new Intl.DateTimeFormat(
    "en-u-ca-islamic-umalqura-nu-latn",
    { month: "numeric", day: "numeric", timeZone: "UTC" },
  );
  let calendarEvents = [];

  const pad = (number) => String(number).padStart(2, "0");
  const isValidColor = (color) => /^#[\da-f]{6}$/i.test(color);
  const toDateKey = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const fromDateKey = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  };
  const startOfWeek = (date) => {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() - result.getDay());
    return result;
  };
  const matchesSearch = (event, query) => {
    if (!query) return true;
    return `${event.title} ${event.description} ${categoryNames[event.category] || ""}`
      .toLowerCase()
      .includes(query);
  };
  const eventsForDate = (date, query) =>
    calendarEvents
      .filter(
        (event) =>
          event.date === toDateKey(date) &&
          (observanceToggle.checked || !event.isInternational) &&
          (pakistanHolidayToggle.checked || !event.isPakistanHoliday) &&
          matchesSearch(event, query),
      )
      .sort((first, second) => {
        if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
        return (first.time || "").localeCompare(second.time || "");
      });

  function nthWeekdayOfMonth(year, month, weekday, occurrence) {
    const first = new Date(year, month, 1);
    return 1 + ((weekday - first.getDay() + 7) % 7) + (occurrence - 1) * 7;
  }

  function lastWeekdayOfMonth(year, month, weekday) {
    const last = new Date(year, month + 1, 0);
    return last.getDate() - ((last.getDay() - weekday + 7) % 7);
  }

  function makeInternationalEvent(year, month, day, name) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    return {
      id: `international-${date}-${name}`,
      title: name,
      date,
      time: "",
      allDay: true,
      category: "international",
      description: "International observance. It is not a public holiday in every country.",
      isInternational: true,
    };
  }

  function makePakistanHoliday(year, month, day, name, isEstimated = false) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    return {
      id: `pakistan-${date}-${name}`,
      title: name,
      date,
      time: "",
      allDay: true,
      category: "pakistan",
      description: isEstimated
        ? "Estimated Pakistan public holiday based on the Umm al-Qura Hijri calendar. The official date may vary with moon sighting."
        : "Pakistan national public holiday.",
      isPakistanHoliday: true,
      isEstimated,
    };
  }

  function getInternationalEvents(year) {
    const result = fixedObservances.map(([monthDay, name]) => {
      const [month, day] = monthDay.split("-").map(Number);
      return makeInternationalEvent(year, month, day, name);
    });
    result.push(
      makeInternationalEvent(
        year,
        10,
        nthWeekdayOfMonth(year, 9, 1, 1),
        "World Habitat Day",
      ),
      makeInternationalEvent(
        year,
        5,
        nthWeekdayOfMonth(year, 4, 6, 2),
        "World Migratory Bird Day",
      ),
      makeInternationalEvent(
        year,
        10,
        nthWeekdayOfMonth(year, 9, 6, 2),
        "World Migratory Bird Day",
      ),
      makeInternationalEvent(
        year,
        3,
        lastWeekdayOfMonth(year, 2, 6),
        "Earth Hour",
      ),
    );
    return result;
  }

  function getPakistanHolidays(year) {
    const result = fixedPakistanHolidays.map(([monthDay, name]) => {
      const [month, day] = monthDay.split("-").map(Number);
      return makePakistanHoliday(year, month, day, name);
    });
    const hijriHolidayNames = {
      "1-9": "Ashura (9 Muharram)",
      "1-10": "Ashura (10 Muharram)",
      "3-12": "Eid Milad-un-Nabi",
      "10-1": "Eid-ul-Fitr",
      "10-2": "Eid-ul-Fitr (Day 2)",
      "10-3": "Eid-ul-Fitr (Day 3)",
      "12-10": "Eid-ul-Adha",
      "12-11": "Eid-ul-Adha (Day 2)",
      "12-12": "Eid-ul-Adha (Day 3)",
    };
    const date = new Date(Date.UTC(year, 0, 1, 12));
    while (date.getUTCFullYear() === year) {
      const hijriParts = hijriDateFormatter.formatToParts(date);
      const hijriMonth = Number(hijriParts.find((part) => part.type === "month")?.value);
      const hijriDay = Number(hijriParts.find((part) => part.type === "day")?.value);
      const holidayName = hijriHolidayNames[`${hijriMonth}-${hijriDay}`];
      if (holidayName) {
        result.push(
          makePakistanHoliday(
            year,
            date.getUTCMonth() + 1,
            date.getUTCDate(),
            holidayName,
            true,
          ),
        );
      }
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return result;
  }

  function visibleDateRange() {
    if (viewSelect.value === "day") {
      const date = new Date(displayedDate);
      return [date, date];
    }
    if (viewSelect.value === "year") {
      return [
        new Date(displayedDate.getFullYear(), 0, 1),
        new Date(displayedDate.getFullYear(), 11, 31),
      ];
    }
    if (viewSelect.value === "week") {
      const first = startOfWeek(displayedDate);
      const last = new Date(first);
      last.setDate(last.getDate() + 6);
      return [first, last];
    }
    const first = startOfWeek(new Date(displayedDate.getFullYear(), displayedDate.getMonth(), 1));
    const last = new Date(first);
    last.setDate(last.getDate() + 41);
    return [first, last];
  }

  function loadLocalEvents() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Saved calendar events are not a list.");
      localEvents = parsed.filter(
        (event) =>
          event &&
          typeof event.id === "string" &&
          typeof event.title === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(event.date),
      );
    } catch (error) {
      console.error("Unable to load saved calendar events:", error);
    }
  }

  function saveLocalEvents() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(localEvents));
      return true;
    } catch (error) {
      console.error("Unable to save local calendar events:", error);
      formError.textContent = "The event could not be saved in this browser. Check available storage and try again.";
      formError.hidden = false;
      return false;
    }
  }

  function updateEvents() {
    events = Array.from(
      new Map([...localEvents, ...cloudEvents].map((event) => [event.id, event])).values(),
    );
    render();
  }

  function userEventPath(userKey, eventId) {
    return `calendarEvents/${calendarCompanyKey}/${userKey}/${eventId}`;
  }

  async function saveSharedEvent(event, previousEvent) {
    if (
      !firebase ||
      !companyId ||
      !currentUid ||
      !currentRole ||
      !firebase.push ||
      !firebase.serverTimestamp
    ) {
      throw new Error("Calendar sharing is unavailable because your account or database connection could not be identified.");
    }

    const selectedUsers = Array.from(
      userOptions.querySelectorAll('input[name="sharedWith"]:checked'),
      (input) => input.value,
    );
    const eventToSave = {
      ...event,
      companyId,
      createdByKey: event.createdByKey || currentUserKey,
      createdByRole: event.createdByRole || currentRole,
      createdById: event.createdById || currentUid,
      createdByName: event.createdByName || currentUsername,
      sharedWith: selectedUsers,
      updatedAt: new Date().toISOString(),
    };
    const recipients = [...new Set([eventToSave.createdByKey, ...selectedUsers])];
    const updates = {};
    recipients.forEach((recipientKey) => {
      updates[userEventPath(recipientKey, eventToSave.id)] = eventToSave;
    });
    (previousEvent?.sharedWith || []).forEach((recipientKey) => {
      if (!recipients.includes(recipientKey)) {
        updates[userEventPath(recipientKey, eventToSave.id)] = null;
      }
    });
    const previousRecipients = new Set(previousEvent?.sharedWith || []);
    selectedUsers
      .filter((recipientKey) => !previousRecipients.has(recipientKey))
      .forEach((recipientKey) => {
        const separator = recipientKey.indexOf("_");
        const recipientRole = recipientKey.slice(0, separator);
        const recipientId = recipientKey.slice(separator + 1);
        if (!recipientRole || !recipientId) {
          throw new Error("A selected user has an invalid account identifier.");
        }
        const notificationRef = firebase.push(
          firebase.ref(
            firebase.database,
            `notifications/${recipientRole}/${recipientId}`,
          ),
        );
        updates[`notifications/${recipientRole}/${recipientId}/${notificationRef.key}`] = {
          kind: "calendar-event",
          title: "New calendar event",
          message: `${currentUsername} shared "${eventToSave.title}" with you for ${eventToSave.date}.`,
          eventId: eventToSave.id,
          read: false,
          timestamp: firebase.serverTimestamp(),
        };
      });

    await firebase.update(firebase.ref(firebase.database), updates);
    return eventToSave;
  }

  async function deleteSharedEvent(event) {
    if (!firebase || !companyId) {
      throw new Error("Calendar sharing is unavailable because your database connection could not be identified.");
    }
    const recipients = [...new Set([event.createdByKey, ...(event.sharedWith || [])])].filter(Boolean);
    const updates = {};
    recipients.forEach((recipientKey) => {
      updates[userEventPath(recipientKey, event.id)] = null;
    });
    await firebase.update(firebase.ref(firebase.database), updates);
  }

  async function loadShareUsers() {
    if (!firebase || !companyId || !currentUid || !currentRole) {
      userOptions.replaceChildren(addText(userOptions, "span", "calendar-user-error", "Could not identify your account."));
      return;
    }
    try {
      const snapshot = await firebase.get(firebase.ref(firebase.database, "users"));
      const records = snapshot.val() || {};
      availableUsers = ["admins", "workers"].flatMap((role) =>
        Object.entries(records[role] || {})
          .filter(([id, user]) =>
            user &&
            String(user.companyid || "") === companyId &&
            !(role === currentRole && id === currentUid),
          )
          .map(([id, user]) => ({
            key: `${role}_${id}`,
            name: String(user.username || user.email || "Unnamed user"),
            role,
          })),
      ).sort((first, second) => first.name.localeCompare(second.name));

      shareUsersLoaded = true;
      userOptions.replaceChildren();
      if (!availableUsers.length) {
        userOptions.append(addText(userOptions, "span", "calendar-user-empty", "No other users found in your company."));
        return;
      }
      availableUsers.forEach((user) => {
        const label = document.createElement("label");
        label.className = "calendar-user-option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "sharedWith";
        checkbox.value = user.key;
        label.append(checkbox, document.createTextNode(user.name));
        userOptions.append(label);
      });
    } catch (error) {
      console.error("Unable to load calendar share users:", error);
      shareUsersLoaded = false;
      userOptions.replaceChildren(
        addText(userOptions, "span", "calendar-user-error", "Could not load users. Try reloading the page."),
      );
      shareStatus.textContent = "User list could not be loaded; events cannot be shared until it is available.";
      shareStatus.hidden = false;
    }
  }

  function subscribeToEvents() {
    if (!firebase || !companyId || !currentUid || !currentRole) {
      shareStatus.textContent = "Calendar events could not be synced because your account or database connection is unavailable.";
      shareStatus.hidden = false;
      return;
    }
    const path = `calendarEvents/${calendarCompanyKey}/${currentUserKey}`;
    unsubscribeEvents = firebase.onValue(
      firebase.ref(firebase.database, path),
      (snapshot) => {
        const savedEvents = snapshot.val() || {};
        cloudEvents = Object.entries(savedEvents)
          .filter(([, event]) =>
            event &&
            event.companyId === companyId &&
            (event.createdByKey === currentUserKey || (event.sharedWith || []).includes(currentUserKey)),
          )
          .map(([id, event]) => ({ ...event, id }));
        shareStatus.hidden = true;
        updateEvents();
      },
      (error) => {
        console.error("Unable to sync calendar events:", error);
        shareStatus.textContent = "Calendar events could not be synced. Check your connection or access and try again.";
        shareStatus.hidden = false;
      },
    );
  }

  function setSelectedUsers(event) {
    const selectedUsers = new Set(event?.sharedWith || []);
    userOptions.querySelectorAll('input[name="sharedWith"]').forEach((input) => {
      input.checked = selectedUsers.has(input.value);
    });
  }

  function addText(parent, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    parent.append(element);
    return element;
  }

  function setCalendarTitle(view) {
    const options = { month: "long", year: "numeric" };
    if (view === "month") {
      title.textContent = displayedDate.toLocaleDateString(undefined, options);
    } else if (view === "year") {
      title.textContent = String(displayedDate.getFullYear());
    } else if (view === "day") {
      title.textContent = displayedDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } else {
      const first = startOfWeek(displayedDate);
      const last = new Date(first);
      last.setDate(last.getDate() + 6);
      const firstText = first.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const lastText = last.toLocaleDateString(undefined, {
        month: first.getMonth() === last.getMonth() ? undefined : "short",
        day: "numeric",
        year: "numeric",
      });
      title.textContent = `${firstText} – ${lastText}`;
    }
  }

  function createEventButton(event, view) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `calendar-event category-${event.category || "work"}`;
    button.title = event.isInternational
      ? `${event.title} · International observance; not a public holiday in every country`
      : event.isPakistanHoliday
        ? `${event.title} · Pakistan national holiday${event.isEstimated ? "; date estimated, subject to moon sighting" : ""}`
        : `${event.allDay ? "All day" : formatTime(event.time)} · ${event.title}`;
    button.textContent = `${event.allDay ? "" : `${formatTime(event.time)} `}${event.title}`;
    if (isValidColor(event.color)) {
      const red = parseInt(event.color.slice(1, 3), 16);
      const green = parseInt(event.color.slice(3, 5), 16);
      const blue = parseInt(event.color.slice(5, 7), 16);
      const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
      button.style.backgroundColor = `rgba(${red}, ${green}, ${blue}, 0.2)`;
      button.style.color = luminance > 155 ? "#263746" : "#ffffff";
      button.style.borderLeftColor = event.color;
    }
    button.addEventListener("click", (click) => {
      click.stopPropagation();
      if (!event.isInternational && !event.isPakistanHoliday) {
        if (!event.createdByKey || event.createdByKey === currentUserKey) {
          openEventDialog(event);
        }
      }
    });
    if (event.isInternational || event.isPakistanHoliday) {
      const eventType = event.isPakistanHoliday
        ? `Pakistan national holiday${event.isEstimated ? ", estimated date" : ""}`
        : "international observance";
      button.setAttribute("aria-label", `${event.title}, ${eventType}`);
    }
    if (view === "week" || view === "day") {
      button.className = `calendar-week-event category-${event.category || "work"}`;
      button.textContent = `${event.allDay ? "" : `${formatTime(event.time)} `}${event.title}`;
    }
    return button;
  }

  function formatTime(value) {
    if (!value) return "";
    const [hours, minutes] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function renderMonth(query) {
    const grid = addText(calendar, "div", "calendar-month-grid");
    weekdays.forEach((day) => addText(grid, "div", "calendar-weekday", day));

    const monthStart = new Date(displayedDate.getFullYear(), displayedDate.getMonth(), 1);
    const firstCell = startOfWeek(monthStart);
    const todayKey = toDateKey(new Date());

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(firstCell);
      date.setDate(firstCell.getDate() + index);
      const key = toDateKey(date);
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-day";
      if (date.getMonth() !== displayedDate.getMonth()) dayCell.classList.add("outside-month");
      if (key === todayKey) dayCell.classList.add("today");
      dayCell.setAttribute("aria-label", date.toLocaleDateString());
      dayCell.addEventListener("click", () => {
        if (date.getMonth() !== displayedDate.getMonth()) {
          displayedDate.setTime(date);
          render();
        }
        openEventDialog(null, key);
      });

      addText(dayCell, "span", "calendar-day-number", String(date.getDate()));
      const eventList = addText(dayCell, "div", "calendar-day-events");
      const dayEvents = eventsForDate(date, query);
      dayEvents.slice(0, 3).forEach((event) => eventList.append(createEventButton(event, "month")));
      if (dayEvents.length > 3) {
        addText(eventList, "span", "calendar-more-events", `+${dayEvents.length - 3} more`);
      }
      grid.append(dayCell);
    }
  }

  function renderYear(query) {
    const yearGrid = addText(calendar, "div", "calendar-year-grid");
    const todayKey = toDateKey(new Date());
    for (let month = 0; month < 12; month += 1) {
      const monthCard = addText(yearGrid, "section", "calendar-year-month");
      const monthButton = addText(
        monthCard,
        "button",
        "calendar-year-month-title",
        new Date(displayedDate.getFullYear(), month, 1).toLocaleDateString(undefined, {
          month: "long",
        }),
      );
      monthButton.type = "button";
      monthButton.addEventListener("click", () => {
        displayedDate.setMonth(month, 1);
        viewSelect.value = "month";
        render();
      });

      const monthGrid = addText(monthCard, "div", "calendar-year-month-grid");
      weekdays.forEach((day) => addText(monthGrid, "span", "calendar-year-weekday", day[0]));
      const firstDay = new Date(displayedDate.getFullYear(), month, 1).getDay();
      const daysInMonth = new Date(displayedDate.getFullYear(), month + 1, 0).getDate();
      for (let blank = 0; blank < firstDay; blank += 1) {
        addText(monthGrid, "span", "calendar-year-blank");
      }
      for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
        const date = new Date(displayedDate.getFullYear(), month, dayNumber);
        const key = toDateKey(date);
        const dayEvents = eventsForDate(date, query);
        const dayButton = addText(
          monthGrid,
          "button",
          `calendar-year-day${key === todayKey ? " today" : ""}${dayEvents.length ? " has-events" : ""}`,
          String(dayNumber),
        );
        dayButton.type = "button";
        dayButton.setAttribute("aria-label", `${date.toLocaleDateString()}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`);
        if (dayEvents.length) {
          dayButton.title = dayEvents.map((event) => event.title).join(", ");
          const eventColor = dayEvents.find((event) => isValidColor(event.color))?.color;
          dayButton.style.setProperty("--calendar-day-event-color", eventColor || "#087bb7");
        }
        dayButton.addEventListener("click", () => {
          displayedDate.setTime(date);
          viewSelect.value = "day";
          render();
        });
      }
    }
  }

  function renderTimeGrid(dates, query, isWeek) {
    const wrapper = addText(calendar, "div", isWeek ? "calendar-week-grid" : "calendar-day-grid");
    const labels = addText(wrapper, "div", "calendar-time-labels");
    addText(labels, "div", "calendar-column-heading");
    for (let hour = 0; hour < 24; hour += 1) {
      const time = new Date();
      time.setHours(hour, 0, 0, 0);
      addText(labels, "div", "calendar-time-label", time.toLocaleTimeString([], { hour: "numeric" }));
    }

    const columns = addText(wrapper, "div", isWeek ? "calendar-week-columns" : "calendar-day-column");
    const todayKey = toDateKey(new Date());
    dates.forEach((date) => {
      const column = isWeek
        ? addText(columns, "div", "calendar-day-column")
        : columns;
      const heading = addText(
        column,
        "div",
        `calendar-column-heading${toDateKey(date) === todayKey ? " today" : ""}`,
      );
      heading.append(document.createTextNode(weekdays[date.getDay()]));
      addText(heading, "strong", "", String(date.getDate()));

      const dayEvents = eventsForDate(date, query);
      dayEvents
        .filter((event) => event.allDay)
        .forEach((event) => {
          const eventButton = createEventButton(event, "month");
          eventButton.classList.add("calendar-all-day-event");
          heading.append(eventButton);
        });

      const slots = addText(column, "div", "calendar-time-slots");
      slots.addEventListener("click", (click) => {
        if (click.target !== slots) return;
        const bounds = slots.getBoundingClientRect();
        const minutes = Math.floor(((click.clientY - bounds.top + slots.scrollTop) / 52) * 60 / 30) * 30;
        const selected = new Date(date);
        selected.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        openEventDialog(null, toDateKey(date), `${pad(selected.getHours())}:${pad(selected.getMinutes())}`);
      });

      dayEvents
        .filter((event) => !event.allDay && event.time)
        .forEach((event) => {
          const [hour, minute] = event.time.split(":").map(Number);
          const button = createEventButton(event, "week");
          button.style.top = `${hour * 52 + (minute / 60) * 52 + 2}px`;
          button.style.height = "46px";
          slots.append(button);
        });
    });
  }

  function render() {
    const view = viewSelect.value;
    const query = searchInput.value.trim().toLowerCase();
    const [visibleStart, visibleEnd] = visibleDateRange();
    const firstYear = visibleStart.getFullYear();
    const lastYear = visibleEnd.getFullYear();
    const observances = [];
    for (let year = firstYear; year <= lastYear; year += 1) {
      observances.push(
        ...getInternationalEvents(year),
        ...getPakistanHolidays(year),
      );
    }
    calendarEvents = [...events, ...observances];
    setCalendarTitle(view);
    calendar.replaceChildren();

    if (view === "year") {
      renderYear(query);
    } else if (view === "month") {
      renderMonth(query);
    } else if (view === "week") {
      const firstDay = startOfWeek(displayedDate);
      const dates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(firstDay);
        date.setDate(firstDay.getDate() + index);
        return date;
      });
      renderTimeGrid(dates, query, true);
    } else {
      renderTimeGrid([new Date(displayedDate)], query, false);
    }

    const hasMatches = calendarEvents.some((event) => {
      const eventDate = fromDateKey(event.date);
      return (
        eventDate >= visibleStart &&
        eventDate <= visibleEnd &&
        (observanceToggle.checked || !event.isInternational) &&
        (pakistanHolidayToggle.checked || !event.isPakistanHoliday) &&
        matchesSearch(event, query)
      );
    });
    emptySearchMessage.hidden = !query || hasMatches;
  }

  function openEventDialog(event, date = toDateKey(displayedDate), time = "") {
    if (event?.createdByKey && event.createdByKey !== currentUserKey) return;
    if (!shareUsersLoaded) {
      shareStatus.textContent = "Please wait for the company user list to load before creating or editing events.";
      shareStatus.hidden = false;
      return;
    }
    editingEventId = event ? event.id : null;
    form.reset();
    formTitle.textContent = event ? "Edit event" : "Create event";
    titleInput.value = event ? event.title : "";
    dateInput.value = event ? event.date : date;
    timeInput.value = event ? event.time || "" : time;
    allDayInput.checked = event ? Boolean(event.allDay) : false;
    categoryInput.value = event ? event.category || "work" : "work";
    colorInput.value = event && isValidColor(event.color) ? event.color : "#f4c542";
    descriptionInput.value = event ? event.description || "" : "";
    const reminders = event?.reminders || {};
    reminderAtEventInput.checked = reminders.atEventTime !== false;
    reminderDayBeforeInput.checked = Boolean(reminders.oneDayBefore);
    reminderRepeatInput.checked = Boolean(reminders.repeatEnabled);
    reminderIntervalInput.value = String(reminders.repeatInterval || 30);
    reminderUnitInput.value = reminders.repeatUnit || "hours";
    reminderCountInput.value = String(reminders.repeatCount || 2);
    repeatSettings.classList.toggle("is-disabled", !reminderRepeatInput.checked);
    reminderIntervalInput.disabled = !reminderRepeatInput.checked;
    reminderUnitInput.disabled = !reminderRepeatInput.checked;
    reminderCountInput.disabled = !reminderRepeatInput.checked;
    setSelectedUsers(event);
    timeInput.disabled = allDayInput.checked;
    deleteButton.hidden = !event;
    formError.hidden = true;
    formError.textContent = "";
    dialog.showModal();
    titleInput.focus();
  }

  function closeDialog() {
    dialog.close();
    editingEventId = null;
  }

  document.getElementById("calendarToday").addEventListener("click", () => {
    displayedDate.setTime(Date.now());
    render();
  });

  document.getElementById("calendarPrevious").addEventListener("click", () => {
    if (viewSelect.value === "year") {
      displayedDate.setFullYear(displayedDate.getFullYear() - 1);
    } else if (viewSelect.value === "month") {
      displayedDate.setDate(1);
      displayedDate.setMonth(displayedDate.getMonth() - 1);
    } else {
      displayedDate.setDate(displayedDate.getDate() - (viewSelect.value === "week" ? 7 : 1));
    }
    render();
  });

  document.getElementById("calendarNext").addEventListener("click", () => {
    if (viewSelect.value === "year") {
      displayedDate.setFullYear(displayedDate.getFullYear() + 1);
    } else if (viewSelect.value === "month") {
      displayedDate.setDate(1);
      displayedDate.setMonth(displayedDate.getMonth() + 1);
    } else {
      displayedDate.setDate(displayedDate.getDate() + (viewSelect.value === "week" ? 7 : 1));
    }
    render();
  });

  document.getElementById("calendarAdd").addEventListener("click", () => openEventDialog());
  viewSelect.addEventListener("change", render);
  searchInput.addEventListener("input", render);
  observanceToggle.addEventListener("change", render);
  pakistanHolidayToggle.addEventListener("change", render);
  document.getElementById("calendarDialogClose").addEventListener("click", closeDialog);
  document.getElementById("calendarCancel").addEventListener("click", closeDialog);
  allDayInput.addEventListener("change", () => {
    timeInput.disabled = allDayInput.checked;
    if (allDayInput.checked) timeInput.value = "";
  });
  reminderRepeatInput.addEventListener("change", () => {
    repeatSettings.classList.toggle("is-disabled", !reminderRepeatInput.checked);
    reminderIntervalInput.disabled = !reminderRepeatInput.checked;
    reminderUnitInput.disabled = !reminderRepeatInput.checked;
    reminderCountInput.disabled = !reminderRepeatInput.checked;
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const eventTitle = titleInput.value.trim();
    if (!eventTitle || !dateInput.value) {
      formError.textContent = "Enter an event title and date.";
      formError.hidden = false;
      return;
    }
    if (!shareUsersLoaded) {
      formError.textContent = "User list is not ready yet. Reload after your users have been loaded.";
      formError.hidden = false;
      return;
    }
    const repeatInterval = Number(reminderIntervalInput.value);
    const repeatCount = Number(reminderCountInput.value);
    if (
      reminderRepeatInput.checked &&
      (!Number.isInteger(repeatInterval) ||
        repeatInterval < 1 ||
        repeatInterval > 365 ||
        !Number.isInteger(repeatCount) ||
        repeatCount < 1 ||
        repeatCount > 20)
    ) {
      formError.textContent = "Repeat interval must be 1–365 and repeat count must be 1–20.";
      formError.hidden = false;
      return;
    }

    const existing = events.find((event) => event.id === editingEventId);
    const nextEvent = {
      id: existing ? existing.id : (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      title: eventTitle,
      date: dateInput.value,
      time: allDayInput.checked ? "" : timeInput.value,
      allDay: allDayInput.checked,
      category: categoryInput.value,
      color: colorInput.value,
      description: descriptionInput.value.trim(),
      reminders: {
        atEventTime: reminderAtEventInput.checked,
        oneDayBefore: reminderDayBeforeInput.checked,
        repeatEnabled: reminderRepeatInput.checked,
        repeatInterval,
        repeatUnit: reminderUnitInput.value,
        repeatCount,
      },
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      createdByKey: existing?.createdByKey || currentUserKey,
      createdByRole: existing?.createdByRole || currentRole,
      createdById: existing?.createdById || currentUid,
      createdByName: existing?.createdByName || currentUsername,
    };
    try {
      const savedEvent = await saveSharedEvent(nextEvent, existing);
      cloudEvents = [
        ...cloudEvents.filter((event) => event.id !== savedEvent.id),
        savedEvent,
      ];
      if (localEvents.some((event) => event.id === nextEvent.id)) {
        localEvents = localEvents.filter((event) => event.id !== nextEvent.id);
        saveLocalEvents();
      }
      closeDialog();
      updateEvents();
    } catch (error) {
      console.error("Unable to save shared calendar event:", error);
      formError.textContent = "Event could not be saved or shared. Check your connection and database access, then try again.";
      formError.hidden = false;
    }
  });

  deleteButton.addEventListener("click", async () => {
    if (!editingEventId) return;
    const event = events.find((savedEvent) => savedEvent.id === editingEventId);
    if (!event) return;
    try {
      if (event.createdByKey) {
        await deleteSharedEvent(event);
        cloudEvents = cloudEvents.filter((savedEvent) => savedEvent.id !== editingEventId);
      } else {
        localEvents = localEvents.filter((savedEvent) => savedEvent.id !== editingEventId);
        if (!saveLocalEvents()) return;
      }
      closeDialog();
      updateEvents();
    } catch (error) {
      console.error("Unable to delete shared calendar event:", error);
      formError.textContent = "Event could not be deleted from all selected users. Check your connection and try again.";
      formError.hidden = false;
    }
  });

  loadLocalEvents();
  updateEvents();
  loadShareUsers();
  subscribeToEvents();
  window.addEventListener("beforeunload", () => {
    if (unsubscribeEvents) unsubscribeEvents();
  });
})();
