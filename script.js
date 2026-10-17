// script_7.js ki pehli 5-6 lines aisi honi chahiye:
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  update,
  remove,
  runTransaction,
  serverTimestamp,
  get,
  child,
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// File ke shuru mein is line ko check karein

// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
// Import the functions you need from the SDKs you need
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCjvPyH-rd2mayh8hEKrAwoxq4p-EMR0Bw",
  authDomain: "imam-tavel-company.firebaseapp.com",
  databaseURL:
    "https://imam-tavel-company-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "imam-tavel-company",
  storageBucket: "imam-tavel-company.firebasestorage.app",
  messagingSenderId: "357684577696",
  appId: "1:357684577696:web:642ef6f708043345afd0c5",
  measurementId: "G-H5QTGK0CNT",
};

// Line 22-27 ko isse badal dein:
const app = initializeApp(firebaseConfig);
const database = getDatabase(app); // Realtime DB ke liye
const db = getFirestore(app);
const firestoreDB = getFirestore(app); // Firestore ke liye
const auth = getAuth(app);
const accountProvisioningApp = initializeApp(firebaseConfig, "account-provisioning");
const accountProvisioningAuth = getAuth(accountProvisioningApp);

// GLOBAL reference banayein taake har jagah use ho sake
window.dbRef = ref(database);
window.database = database;
window.calendarFirebase = {
  database,
  ref,
  get,
  onValue,
  update,
  push,
  serverTimestamp,
};
window.calendarAuth = auth;
window.calendarSignOut = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  window.dispatchEvent(
    new CustomEvent("firebase-auth-state", {
      detail: { uid: user?.uid || "" },
    }),
  );
});

function waitForDatabaseConnection(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Timed out waiting for the database connection."));
    }, timeoutMs);

    unsubscribe = onValue(
      ref(database, ".info/connected"),
      (snapshot) => {
        if (snapshot.val() !== true) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      },
    );
  });
}

async function getDatabaseSnapshot(path) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForDatabaseConnection();
    try {
      return await get(ref(database, path));
    } catch (error) {
      const isOfflineError = error.message?.includes("Client is offline");
      if (!isOfflineError || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw new Error(`Unable to read "${path}" from the database.`);
}

async function loadCustomerReportContacts() {
  const tableBody = document.getElementById("customerContacts");
  if (!tableBody) return;

  const codeFilter = document.getElementById("customerCodeFilter");
  const nameFilter = document.getElementById("customerNameFilter");
  const passportFilter = document.getElementById("customerPassportFilter");
  const searchButton = document.getElementById("customerSearchButton");
  const generateButton = document.getElementById("customerGenerateButton");
  const refreshButton = document.getElementById("customerRefreshButton");
  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  let accounts = [];
  let customerBalances = new Map();
  let selectedContactKey = "";
  const formatAmount = (amount) =>
    Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getPassportNumber = (contact) =>
    contact.passportNo ||
    contact.passportNumber ||
    (contact.documentType?.trim().toLowerCase() === "passport"
      ? contact.documentNo
      : "");

  const renderCustomers = () => {
    const codeQuery = normalize(codeFilter?.value);
    const nameQuery = normalize(nameFilter?.value);
    const passportQuery = normalize(passportFilter?.value);
    const filteredAccounts = accounts.filter(([, contact]) => {
      const contactCode = normalize(contact.contactNumber);
      const contactNumber = normalize(contact.contactNo);
      const name = normalize(contact.fullName);
      const passportNumber = normalize(
        contact.passportNo ||
          contact.passportNumber ||
          (contact.documentType?.trim().toLowerCase() === "passport"
            ? contact.documentNo
            : ""),
      );

      return (
        (!codeQuery ||
          codeQuery === "0" ||
          contactCode.includes(codeQuery) ||
          contactNumber.includes(codeQuery)) &&
        (!nameQuery || name.includes(nameQuery)) &&
        (!passportQuery || passportNumber.includes(passportQuery))
      );
    });

    selectedContactKey = "";
    tableBody.replaceChildren();
    if (filteredAccounts.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="6">No matching accounts found.</td></tr>';
      return;
    }

    filteredAccounts.forEach(([contactKey, contact]) => {
      const row = document.createElement("tr");
      row.dataset.contactKey = contactKey;
      row.tabIndex = 0;
      row.setAttribute(
        "aria-label",
        `View ledger for ${contact.fullName || "account"}`,
      );
      const accountTitle = [
        contact.contactNo,
        contact.fullName,
        getPassportNumber(contact),
      ]
        .filter(Boolean)
        .join(" - ");
      const balance = customerBalances.get(contactKey) || 0;

      [
        contact.contactNumber,
        accountTitle,
        contact.city,
        contact.accountCategory,
        balance !== 0 ? (balance > 0 ? "Dr" : "Cr") : "-",
        formatAmount(balance),
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value || "-";
        row.appendChild(cell);
      });
      tableBody.appendChild(row);
    });
  };

  const navigateToCustomerLedger = (contactKey) => {
    const url = new URL("customers_ledger.html", window.location.href);
    url.searchParams.set("contactKey", contactKey);
    window.location.href = url.href;
  };

  const selectAccountRow = (row) => {
    if (!row) return;
    selectedContactKey = row.dataset.contactKey;
    tableBody.querySelectorAll("tr[data-contact-key]").forEach((accountRow) => {
      const isSelected = accountRow === row;
      accountRow.classList.toggle("selected", isSelected);
      accountRow.setAttribute("aria-selected", String(isSelected));
    });
    row.focus();
  };

  tableBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-contact-key]");
    if (!row) return;
    if (selectedContactKey === row.dataset.contactKey) {
      navigateToCustomerLedger(row.dataset.contactKey);
      return;
    }
    selectAccountRow(row);
  });
  tableBody.addEventListener("keydown", (event) => {
    const rows = [...tableBody.querySelectorAll("tr[data-contact-key]")];
    if (!rows.length) return;
    const currentRow =
      event.target.closest("tr[data-contact-key]") ||
      rows.find((row) => row.dataset.contactKey === selectedContactKey);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = rows.indexOf(currentRow);
      const nextIndex =
        currentIndex < 0
          ? 0
          : (currentIndex +
              (event.key === "ArrowDown" ? 1 : -1) +
              rows.length) %
            rows.length;
      selectAccountRow(rows[nextIndex]);
      return;
    }
    if (event.key !== "Enter" || !currentRow) return;
    event.preventDefault();
    if (selectedContactKey === currentRow.dataset.contactKey) {
      navigateToCustomerLedger(currentRow.dataset.contactKey);
      return;
    }
    selectAccountRow(currentRow);
  });

  [codeFilter, nameFilter, passportFilter].forEach((input) => {
    input?.addEventListener("input", renderCustomers);
  });
  searchButton?.addEventListener("click", renderCustomers);

  const refreshCustomers = async () => {
    const buttons = [generateButton, refreshButton].filter(Boolean);
    buttons.forEach((button) => {
      button.disabled = true;
    });
    tableBody.innerHTML =
      '<tr><td colspan="6">Refreshing accounts...</td></tr>';

    try {
      const snapshot = await getDatabaseSnapshot("contacts");
      const contacts = snapshot.val() || {};
      for (const [key, contact] of Object.entries(contacts)) {
        if (
          !contact ||
          !String(contact.accountCategory || "").trim() ||
          contact.contactNumber
        ) {
          continue;
        }

        const contactNumber = await allocateContactNumber(contacts);
        await update(ref(database, `contacts/${key}`), { contactNumber });
        contacts[key] = { ...contact, contactNumber };
      }
      const [
        bookingsSnapshot,
        cashReceiptsSnapshot,
        cashPaymentsSnapshot,
        bankReceiptsSnapshot,
        bankPaymentsSnapshot,
        bankTransfersSnapshot,
      ] = await Promise.all([
        getDatabaseSnapshot("bookings"),
        getDatabaseSnapshot("cashReceipts"),
        getDatabaseSnapshot("cashPayments"),
        getDatabaseSnapshot("bankReceipts"),
        getDatabaseSnapshot("bankPayments"),
        getDatabaseSnapshot("bankTransfers"),
      ]);
      const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
      const balanceByContact = new Map();
      const addBalance = (contactKey, amount) => {
        balanceByContact.set(
          contactKey,
          (balanceByContact.get(contactKey) || 0) + amount,
        );
      };
      const resolveAccountKey = (accountReference) => {
        const reference = String(accountReference || "").trim();
        if (!reference) return "";
        if (contacts[reference]) return reference;
        const normalizedReference = normalize(reference);
        return (
          Object.entries(contacts).find(
            ([, contact]) =>
              normalize(contact?.fullName) === normalizedReference ||
              normalize(contact?.contactNumber) === normalizedReference,
          )?.[0] || ""
        );
      };
      const parseAmount = (value) => {
        const amount = Number.parseFloat(
          String(value || "0")
            .replace(/,/g, "")
            .trim(),
        );
        return Number.isFinite(amount) ? amount : 0;
      };

      Object.entries(bookingsSnapshot.val() || {}).forEach(([, booking]) => {
        const bookingAmount = parseAmount(
          booking.salePrice || booking.totalFare,
        );
        if (booking.customerContactKey) {
          addBalance(booking.customerContactKey, bookingAmount);
          return;
        }
        const bookingPhone = normalizePhone(booking.contactNo);
        if (!bookingPhone) return;
        Object.entries(contacts).forEach(([key, contact]) => {
          if (
            normalize(contact.accountCategory) === "new customer" &&
            normalizePhone(contact.contactNo) === bookingPhone
          ) {
            addBalance(key, bookingAmount);
          }
        });
      });

      [
        [cashReceiptsSnapshot, -1, "into", 1],
        [cashPaymentsSnapshot, 1, "from", -1],
        [bankReceiptsSnapshot, -1, "into", 1],
        [bankPaymentsSnapshot, 1, "from", -1],
      ].forEach(
        ([snapshot, customerDirection, accountField, accountDirection]) => {
          Object.values(snapshot.val() || {}).forEach((transaction) => {
            const amount = parseAmount(transaction.amount);
            if (transaction.customerContactKey) {
              addBalance(
                transaction.customerContactKey,
                customerDirection * amount,
              );
            }
            const accountKey = resolveAccountKey(transaction[accountField]);
            if (accountKey) addBalance(accountKey, accountDirection * amount);
          });
        },
      );
      Object.values(bankTransfersSnapshot.val() || {}).forEach((transfer) => {
        const amount = parseAmount(transfer.amount);
        const fromKey = resolveAccountKey(transfer.from);
        const toKey = resolveAccountKey(transfer.to);
        if (fromKey) addBalance(fromKey, -amount);
        if (toKey) addBalance(toKey, amount);
      });

      customerBalances = balanceByContact;
      accounts = Object.entries(contacts)
        .filter(([, contact]) => Boolean(contact))
        .sort(([, first], [, second]) =>
          (first.fullName || "").localeCompare(second.fullName || ""),
        );
      renderCustomers();
    } catch (error) {
      console.error("Error refreshing accounts:", error);
      customerBalances = new Map();
      tableBody.innerHTML =
        '<tr><td colspan="6">Unable to refresh accounts. Please check your connection and try again.</td></tr>';
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  };

  generateButton?.addEventListener("click", refreshCustomers);
  refreshButton?.addEventListener("click", refreshCustomers);
  await refreshCustomers();
}

async function loadCustomerLedgerPage() {
  const ledgerEntries = document.getElementById("customerLedgerEntries");
  if (!ledgerEntries) return;

  const ledgerParams = new URLSearchParams(window.location.search);
  if (ledgerParams.get("account") === "cash-in-hand") {
    await loadCashInHandLedgerPage();
    return;
  }
  if (ledgerParams.get("account") === "bank") {
    await loadBankAccountLedgerPage(ledgerParams.get("bankKey"));
    return;
  }
  const contactKey = ledgerParams.get("contactKey");
  const codeElement = document.getElementById("customerLedgerCode");
  const accountElement = document.getElementById("customerLedgerAccount");
  const cityElement = document.getElementById("customerLedgerCity");
  const entryCountElement = document.getElementById("customerLedgerEntryCount");
  const debitTotalElement = document.getElementById("customerLedgerDebitTotal");
  const creditTotalElement = document.getElementById(
    "customerLedgerCreditTotal",
  );
  const balanceTotalElement = document.getElementById(
    "customerLedgerBalanceTotal",
  );
  const refreshButtons = [
    document.getElementById("customerLedgerGenerate"),
    document.getElementById("customerLedgerRefresh"),
  ].filter(Boolean);
  let selectedEntryKey = "";
  const formatAmount = (amount) =>
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const formatBalance = (balance) => formatAmount(Math.abs(balance));
  const showMessage = (message) => {
    ledgerEntries.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 13;
    cell.textContent = message;
    row.appendChild(cell);
    ledgerEntries.appendChild(row);
  };

  document.getElementById("customerLedgerDate").textContent =
    new Date().toLocaleDateString();

  const loadLedger = async () => {
    if (!contactKey) {
      showMessage(
        "Customer details are missing. Return to Customers and select a customer.",
      );
      return;
    }

    refreshButtons.forEach((button) => {
      button.disabled = true;
    });
    showMessage("Loading customer ledger...");

    try {
      const contactSnapshot = await getDatabaseSnapshot(
        `contacts/${contactKey}`,
      );
      const contact = contactSnapshot.val();
      if (!contact) {
        throw new Error("The selected customer could not be found.");
      }

      const passportNumber =
        contact.passportNo ||
        contact.passportNumber ||
        (contact.documentType?.trim().toLowerCase() === "passport"
          ? contact.documentNo
          : "");
      codeElement.value = contact.contactNumber || "";
      accountElement.value = [
        contact.contactNo,
        contact.fullName,
        passportNumber,
      ]
        .filter(Boolean)
        .join(" - ");
      cityElement.value = contact.city || "";

      const [
        bookingsSnapshot,
        receiptsSnapshot,
        paymentsSnapshot,
        bankReceiptsSnapshot,
        bankPaymentsSnapshot,
        bankTransfersSnapshot,
      ] = await Promise.all([
        getDatabaseSnapshot("bookings"),
        getDatabaseSnapshot("cashReceipts"),
        getDatabaseSnapshot("cashPayments"),
        getDatabaseSnapshot("bankReceipts"),
        getDatabaseSnapshot("bankPayments"),
        getDatabaseSnapshot("bankTransfers"),
      ]);
      const bookings = bookingsSnapshot.val() || {};
      const receipts = receiptsSnapshot.val() || {};
      const payments = paymentsSnapshot.val() || {};
      const bankReceipts = bankReceiptsSnapshot.val() || {};
      const bankPayments = bankPaymentsSnapshot.val() || {};
      const bankTransfers = bankTransfersSnapshot.val() || {};
      const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
      const normalizeAccountReference = (value) =>
        String(value || "")
          .trim()
          .toLowerCase();
      const matchesAccountReference = (accountReference) => {
        const reference = String(accountReference || "").trim();
        if (!reference) return false;
        return (
          reference === contactKey ||
          normalizeAccountReference(reference) ===
            normalizeAccountReference(contact.fullName) ||
          normalizeAccountReference(reference) ===
            normalizeAccountReference(contact.contactNumber)
        );
      };
      const customerPhone = normalizePhone(contact.contactNo);
      const matchingBookings = Object.entries(bookings)
        .filter(([, booking]) => {
          if (booking.customerContactKey) {
            return booking.customerContactKey === contactKey;
          }
          return (
            customerPhone && normalizePhone(booking.contactNo) === customerPhone
          );
        })
        .map(([key, booking]) => ({
          key,
          record: booking,
          kind: "booking",
          time: Number(booking.timestamp) || Date.parse(booking.datetime) || 0,
        }));
      const matchingReceipts = Object.entries(receipts).flatMap(
        ([key, receipt]) => [
          ...(receipt.customerContactKey === contactKey
            ? [
                {
                  key,
                  record: receipt,
                  kind: "receipt",
                  time:
                    Number(receipt.timestamp) || Date.parse(receipt.date) || 0,
                },
              ]
            : []),
          ...(matchesAccountReference(receipt.into)
            ? [
                {
                  key,
                  record: receipt,
                  kind: "cashReceiptAccount",
                  time:
                    Number(receipt.timestamp) || Date.parse(receipt.date) || 0,
                },
              ]
            : []),
        ],
      );
      const matchingPayments = Object.entries(payments).flatMap(
        ([key, payment]) => [
          ...(payment.customerContactKey === contactKey
            ? [
                {
                  key,
                  record: payment,
                  kind: "payment",
                  time:
                    Number(payment.timestamp) || Date.parse(payment.date) || 0,
                },
              ]
            : []),
          ...(matchesAccountReference(payment.from)
            ? [
                {
                  key,
                  record: payment,
                  kind: "cashPaymentAccount",
                  time:
                    Number(payment.timestamp) || Date.parse(payment.date) || 0,
                },
              ]
            : []),
        ],
      );
      const matchingBankReceipts = Object.entries(bankReceipts).flatMap(
        ([key, receipt]) => [
          ...(receipt.customerContactKey === contactKey
            ? [
                {
                  key,
                  record: receipt,
                  kind: "bankReceipt",
                  time:
                    Number(receipt.timestamp) || Date.parse(receipt.date) || 0,
                },
              ]
            : []),
          ...(matchesAccountReference(receipt.into)
            ? [
                {
                  key,
                  record: receipt,
                  kind: "bankReceiptAccount",
                  time:
                    Number(receipt.timestamp) || Date.parse(receipt.date) || 0,
                },
              ]
            : []),
        ],
      );
      const matchingBankPayments = Object.entries(bankPayments).flatMap(
        ([key, payment]) => [
          ...(payment.customerContactKey === contactKey
            ? [
                {
                  key,
                  record: payment,
                  kind: "bankPayment",
                  time:
                    Number(payment.timestamp) || Date.parse(payment.date) || 0,
                },
              ]
            : []),
          ...(matchesAccountReference(payment.from)
            ? [
                {
                  key,
                  record: payment,
                  kind: "bankPaymentAccount",
                  time:
                    Number(payment.timestamp) || Date.parse(payment.date) || 0,
                },
              ]
            : []),
        ],
      );
      const matchingBankTransfers = Object.entries(bankTransfers).flatMap(
        ([key, transfer]) => [
          ...(matchesAccountReference(transfer.from)
            ? [
                {
                  key,
                  record: transfer,
                  kind: "bankTransferOut",
                  time:
                    Number(transfer.timestamp) ||
                    Date.parse(transfer.date) ||
                    0,
                },
              ]
            : []),
          ...(matchesAccountReference(transfer.to)
            ? [
                {
                  key,
                  record: transfer,
                  kind: "bankTransferIn",
                  time:
                    Number(transfer.timestamp) ||
                    Date.parse(transfer.date) ||
                    0,
                },
              ]
            : []),
        ],
      );
      const ledgerItems = [
        ...matchingBookings,
        ...matchingReceipts,
        ...matchingPayments,
        ...matchingBankReceipts,
        ...matchingBankPayments,
        ...matchingBankTransfers,
      ].sort((first, second) => {
        if (first.time !== second.time) return first.time - second.time;
        return first.key.localeCompare(second.key);
      });

      ledgerEntries.replaceChildren();
      let balance = 0;
      let debitTotal = 0;
      let creditTotal = 0;
      ledgerItems.forEach(({ record, kind, key }, index) => {
        const amountValue =
          kind !== "booking"
            ? record.amount
            : record.salePrice || record.totalFare || "0";
        const amount = Number.parseFloat(
          String(amountValue || "0")
            .replace(/,/g, "")
            .trim(),
        );
        const isCredit = [
          "receipt",
          "bankReceipt",
          "cashPaymentAccount",
          "bankPaymentAccount",
          "bankTransferOut",
        ].includes(kind);
        const debit = !isCredit && Number.isFinite(amount) ? amount : 0;
        const credit = isCredit && Number.isFinite(amount) ? amount : 0;
        debitTotal += debit;
        creditTotal += credit;
        balance += debit - credit;

        const rawDate =
          record.date || record.timestamp || record.datetime || "";
        const parsedDate = new Date(rawDate);
        const date =
          rawDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toLocaleDateString()
            : "-";
        const passengerName =
          kind === "booking"
            ? [record.title, record.surname, record.givenName]
                .filter(Boolean)
                .join(" ")
            : "";
        const description =
          kind !== "booking"
            ? record.memo ||
              {
                receipt: "Cash receipt",
                payment: "Cash payment",
                bankReceipt: "Bank receipt",
                bankPayment: "Bank payment",
                cashReceiptAccount: "Cash receipt",
                cashPaymentAccount: "Cash payment",
                bankReceiptAccount: "Bank receipt",
                bankPaymentAccount: "Bank payment",
                bankTransferIn: "Bank transfer",
                bankTransferOut: "Bank transfer",
              }[kind] ||
              "Cash receipt"
            : [record.route, record.remarks || passengerName]
                .filter(Boolean)
                .join(" - ") || "Customer booking";
        const row = document.createElement("tr");
        const transactionCode =
          {
            receipt: "CR",
            cashReceiptAccount: "CR",
            bankReceipt: "BR",
            bankReceiptAccount: "BR",
            bankTransferIn: "BT",
            bankTransferOut: "BT",
            bankPayment: "BP",
            bankPaymentAccount: "BP",
            payment: "CP",
            cashPaymentAccount: "CP",
          }[kind] || "SALE";
        const collectionByKind = {
          booking: "bookings",
          receipt: "cashReceipts",
          cashReceiptAccount: "cashReceipts",
          payment: "cashPayments",
          cashPaymentAccount: "cashPayments",
          bankReceipt: "bankReceipts",
          bankReceiptAccount: "bankReceipts",
          bankPayment: "bankPayments",
          bankPaymentAccount: "bankPayments",
          bankTransferIn: "bankTransfers",
          bankTransferOut: "bankTransfers",
        };
        row.dataset.entryKey = key;
        row.dataset.collection = collectionByKind[kind];
        row.tabIndex = 0;
        row.setAttribute("aria-label", `Select ${description}`);

        [
          String(index + 1),
          transactionCode,
          date,
          kind !== "booking" ? record.reference : record.transNo,
          kind !== "booking" ? record.reference : record.ticketno,
          kind === "booking" ? record.pnr : "-",
          kind === "booking" ? record.passportNo : passportNumber,
          description,
          debit ? formatAmount(debit) : "-",
          credit ? formatAmount(credit) : "-",
          formatBalance(balance),
          isCredit ? "CR" : "DB",
          "-",
        ].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value || "-";
          row.appendChild(cell);
        });
        ledgerEntries.appendChild(row);
      });

      selectedEntryKey = "";
      if (ledgerItems.length === 0) {
        showMessage("No ledger entries found for this customer.");
      }

      entryCountElement.textContent = String(ledgerItems.length);
      debitTotalElement.textContent = formatAmount(debitTotal);
      creditTotalElement.textContent = formatAmount(creditTotal);
      balanceTotalElement.textContent = formatBalance(balance);
    } catch (error) {
      console.error("Error loading customer ledger:", error);
      showMessage(
        `Unable to load this customer ledger: ${error.message || "Please check your connection and try again."}`,
      );
    } finally {
      refreshButtons.forEach((button) => {
        button.disabled = false;
      });
    }
  };

  const openLedgerEntry = (row) => {
    if (!row?.dataset.entryKey || !row.dataset.collection) return;
    const reportUrl = new URL(
      "customer_ledger_report.html",
      window.location.href,
    );
    reportUrl.searchParams.set("contactKey", contactKey || "");
    reportUrl.searchParams.set("collection", row.dataset.collection);
    reportUrl.searchParams.set("entryKey", row.dataset.entryKey);
    window.location.href = reportUrl.href;
  };
  const selectLedgerEntry = (row) => {
    if (!row) return;
    selectedEntryKey = row.dataset.entryKey;
    ledgerEntries.querySelectorAll("tr[data-entry-key]").forEach((entryRow) => {
      const isSelected = entryRow === row;
      entryRow.classList.toggle("selected", isSelected);
      entryRow.setAttribute("aria-selected", String(isSelected));
    });
    row.focus();
  };
  ledgerEntries.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-entry-key]");
    if (row) selectLedgerEntry(row);
  });
  ledgerEntries.addEventListener("dblclick", (event) => {
    const row = event.target.closest("tr[data-entry-key]");
    if (row) openLedgerEntry(row);
  });
  ledgerEntries.addEventListener("keydown", (event) => {
    const rows = [...ledgerEntries.querySelectorAll("tr[data-entry-key]")];
    if (!rows.length) return;
    const currentRow =
      event.target.closest("tr[data-entry-key]") ||
      rows.find((row) => row.dataset.entryKey === selectedEntryKey);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = rows.indexOf(currentRow);
      const nextIndex =
        currentIndex < 0
          ? 0
          : (currentIndex +
              (event.key === "ArrowDown" ? 1 : -1) +
              rows.length) %
            rows.length;
      selectLedgerEntry(rows[nextIndex]);
      return;
    }
    if (event.key !== "Enter" || !currentRow) return;
    event.preventDefault();
    if (selectedEntryKey === currentRow.dataset.entryKey) {
      openLedgerEntry(currentRow);
    } else {
      selectLedgerEntry(currentRow);
    }
  });

  refreshButtons.forEach((button) => {
    button.addEventListener("click", loadLedger);
  });
  await loadLedger();
}

async function loadCashInHandLedgerPage() {
  const ledgerEntries = document.getElementById("customerLedgerEntries");
  const codeElement = document.getElementById("customerLedgerCode");
  const accountElement = document.getElementById("customerLedgerAccount");
  const cityElement = document.getElementById("customerLedgerCity");
  const entryCountElement = document.getElementById("customerLedgerEntryCount");
  const debitTotalElement = document.getElementById("customerLedgerDebitTotal");
  const creditTotalElement = document.getElementById(
    "customerLedgerCreditTotal",
  );
  const balanceTotalElement = document.getElementById(
    "customerLedgerBalanceTotal",
  );
  const refreshButtons = [
    document.getElementById("customerLedgerGenerate"),
    document.getElementById("customerLedgerRefresh"),
  ].filter(Boolean);
  const formatAmount = (amount) =>
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const showMessage = (message) => {
    ledgerEntries.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 13;
    cell.textContent = message;
    row.appendChild(cell);
    ledgerEntries.appendChild(row);
  };

  document.title = "Cash in Hand Ledger | Imam Travel";
  document.getElementById("customerLedgerDate").textContent =
    new Date().toLocaleDateString();
  document.getElementById("customerLedgerBalanceNote").textContent =
    "Receipts are debits; payments are credits.";
  const backLink = document.getElementById("customerLedgerBack");
  backLink.href = "bank_payment.html";
  backLink.textContent = "Back to Bank Payment";
  codeElement.value = "CASH-IN-HAND";
  accountElement.value = "Cash in Hand";
  cityElement.value = "-";

  const loadLedger = async () => {
    refreshButtons.forEach((button) => {
      button.disabled = true;
    });
    showMessage("Loading Cash in Hand ledger...");

    try {
      const [
        cashReceiptsSnapshot,
        cashPaymentsSnapshot,
        bankPaymentsSnapshot,
        bankReceiptsSnapshot,
      ] = await Promise.all([
        getDatabaseSnapshot("cashReceipts"),
        getDatabaseSnapshot("cashPayments"),
        getDatabaseSnapshot("bankPayments"),
        getDatabaseSnapshot("bankReceipts"),
      ]);
      const cashReference = (value) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      const isCashInHand = (value) =>
        !value || cashReference(value) === "cash in hand";
      const amountFor = (record) => {
        const amount = Number.parseFloat(
          String(record?.amount || "0")
            .replace(/,/g, "")
            .trim(),
        );
        return Number.isFinite(amount) ? amount : null;
      };
      const transactions = [
        ...Object.entries(cashReceiptsSnapshot.val() || {})
          .filter(([, record]) => record && isCashInHand(record.into))
          .map(([key, record]) => ({
            key,
            record,
            type: "CR",
            description: record.memo || "Cash receipt",
            debit: true,
          })),
        ...Object.entries(cashPaymentsSnapshot.val() || {})
          .filter(([, record]) => record && isCashInHand(record.from))
          .map(([key, record]) => ({
            key,
            record,
            type: "CP",
            description: record.memo || "Cash payment",
            debit: false,
          })),
        ...Object.entries(bankPaymentsSnapshot.val() || {})
          .filter(
            ([, record]) =>
              record &&
              (cashReference(record.to) === "cash in hand" ||
                record.toCashInHand === true),
          )
          .map(([key, record]) => ({
            key,
            record,
            type: "BP",
            description: record.memo || "Bank payment to Cash in Hand",
            debit: true,
          })),
        ...Object.entries(bankReceiptsSnapshot.val() || {})
          .filter(
            ([, record]) =>
              record &&
              (record.fromCashInHand === true ||
                record.source === "cash-in-hand"),
          )
          .map(([key, record]) => ({
            key,
            record,
            type: "BR",
            description: record.memo || "Bank receipt from Cash in Hand",
            debit: false,
          })),
      ]
        .map((transaction) => ({
          ...transaction,
          amount: amountFor(transaction.record),
          time:
            Number(transaction.record.timestamp) ||
            Date.parse(transaction.record.date) ||
            0,
        }))
        .filter((transaction) => transaction.amount !== null)
        .sort((first, second) => {
          if (first.time !== second.time) return first.time - second.time;
          return first.key.localeCompare(second.key);
        });

      ledgerEntries.replaceChildren();
      let balance = 0;
      let debitTotal = 0;
      let creditTotal = 0;
      transactions.forEach(
        ({ key, record, type, description, debit, amount }, index) => {
          if (debit) {
            debitTotal += amount;
            balance += amount;
          } else {
            creditTotal += amount;
            balance -= amount;
          }

          const rawDate = record.date || record.timestamp || "";
          const parsedDate = new Date(rawDate);
          const date =
            rawDate && !Number.isNaN(parsedDate.getTime())
              ? parsedDate.toLocaleDateString()
              : "-";
          const row = document.createElement("tr");
          [
            String(index + 1),
            type,
            date,
            record.reference || key,
            record.reference || "-",
            "-",
            "-",
            description,
            debit ? formatAmount(amount) : "-",
            debit ? "-" : formatAmount(amount),
            formatAmount(Math.abs(balance)),
            debit ? "DB" : "CR",
            "-",
          ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value || "-";
            row.appendChild(cell);
          });
          ledgerEntries.appendChild(row);
        },
      );

      if (transactions.length === 0) {
        showMessage("No ledger entries found for Cash in Hand.");
      }
      entryCountElement.textContent = String(transactions.length);
      debitTotalElement.textContent = formatAmount(debitTotal);
      creditTotalElement.textContent = formatAmount(creditTotal);
      balanceTotalElement.textContent = formatAmount(Math.abs(balance));
    } catch (error) {
      console.error("Error loading Cash in Hand ledger:", error);
      showMessage(
        `Unable to load the Cash in Hand ledger: ${error.message || "Please check your connection and try again."}`,
      );
    } finally {
      refreshButtons.forEach((button) => {
        button.disabled = false;
      });
    }
  };

  refreshButtons.forEach((button) => {
    button.addEventListener("click", loadLedger);
  });
  await loadLedger();
}

async function loadBankAccountLedgerPage(bankKey) {
  const ledgerEntries = document.getElementById("customerLedgerEntries");
  const codeElement = document.getElementById("customerLedgerCode");
  const accountElement = document.getElementById("customerLedgerAccount");
  const cityElement = document.getElementById("customerLedgerCity");
  const entryCountElement = document.getElementById("customerLedgerEntryCount");
  const debitTotalElement = document.getElementById("customerLedgerDebitTotal");
  const creditTotalElement = document.getElementById(
    "customerLedgerCreditTotal",
  );
  const balanceTotalElement = document.getElementById(
    "customerLedgerBalanceTotal",
  );
  const refreshButtons = [
    document.getElementById("customerLedgerGenerate"),
    document.getElementById("customerLedgerRefresh"),
  ].filter(Boolean);
  const formatAmount = (amount) =>
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const showMessage = (message) => {
    ledgerEntries.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 13;
    cell.textContent = message;
    row.appendChild(cell);
    ledgerEntries.appendChild(row);
  };

  document.title = "Bank Account Ledger | Imam Travel";
  document.getElementById("customerLedgerDate").textContent =
    new Date().toLocaleDateString();
  document.getElementById("customerLedgerBalanceNote").textContent =
    "Receipts and transfers in are debits; payments and transfers out are credits.";
  const backLink = document.getElementById("customerLedgerBack");
  backLink.href = "bank_payment.html";
  backLink.textContent = "Back to Bank Payment";

  const loadLedger = async () => {
    if (!bankKey) {
      showMessage("Bank account details are missing.");
      return;
    }
    refreshButtons.forEach((button) => {
      button.disabled = true;
    });
    showMessage("Loading bank account ledger...");

    try {
      const [
        accountSnapshot,
        receiptsSnapshot,
        paymentsSnapshot,
        transfersSnapshot,
      ] = await Promise.all([
        getDatabaseSnapshot(`contacts/${bankKey}`),
        getDatabaseSnapshot("bankReceipts"),
        getDatabaseSnapshot("bankPayments"),
        getDatabaseSnapshot("bankTransfers"),
      ]);
      const account = accountSnapshot.val();
      if (
        !account ||
        String(account.accountCategory || "")
          .trim()
          .toLowerCase() !== "new bank account"
      ) {
        throw new Error("The selected bank account could not be found.");
      }
      codeElement.value = account.contactNumber || "";
      accountElement.value = account.fullName || "";
      cityElement.value = account.city || "-";

      const amountFor = (record) => {
        const amount = Number.parseFloat(
          String(record?.amount || "0")
            .replace(/,/g, "")
            .trim(),
        );
        return Number.isFinite(amount) ? amount : null;
      };
      const transactions = [
        ...Object.entries(receiptsSnapshot.val() || {})
          .filter(([, record]) => record && record.into === bankKey)
          .map(([key, record]) => ({
            key,
            record,
            type: "BR",
            description:
              record.memo ||
              `Bank receipt${record.customerName ? ` from ${record.customerName}` : ""}`,
            debit: true,
          })),
        ...Object.entries(paymentsSnapshot.val() || {})
          .filter(([, record]) => record && record.from === bankKey)
          .map(([key, record]) => ({
            key,
            record,
            type: "BP",
            description:
              record.memo ||
              `Bank payment${record.customerName ? ` to ${record.customerName}` : ""}`,
            debit: false,
          })),
        ...Object.entries(transfersSnapshot.val() || {}).flatMap(
          ([key, record]) => [
            ...(record?.to === bankKey
              ? [
                  {
                    key,
                    record,
                    type: "BT",
                    description: record.memo || "Bank transfer in",
                    debit: true,
                  },
                ]
              : []),
            ...(record?.from === bankKey
              ? [
                  {
                    key,
                    record,
                    type: "BT",
                    description: record.memo || "Bank transfer out",
                    debit: false,
                  },
                ]
              : []),
          ],
        ),
      ]
        .map((transaction) => ({
          ...transaction,
          amount: amountFor(transaction.record),
          time:
            Number(transaction.record.timestamp) ||
            Date.parse(transaction.record.date) ||
            0,
        }))
        .filter((transaction) => transaction.amount !== null)
        .sort((first, second) => {
          if (first.time !== second.time) return first.time - second.time;
          return first.key.localeCompare(second.key);
        });

      ledgerEntries.replaceChildren();
      let balance = 0;
      let debitTotal = 0;
      let creditTotal = 0;
      transactions.forEach(
        ({ key, record, type, description, debit, amount }, index) => {
          if (debit) {
            debitTotal += amount;
            balance += amount;
          } else {
            creditTotal += amount;
            balance -= amount;
          }

          const rawDate = record.date || record.timestamp || "";
          const parsedDate = new Date(rawDate);
          const date =
            rawDate && !Number.isNaN(parsedDate.getTime())
              ? parsedDate.toLocaleDateString()
              : "-";
          const row = document.createElement("tr");
          [
            String(index + 1),
            type,
            date,
            record.reference || key,
            record.reference || "-",
            "-",
            "-",
            description,
            debit ? formatAmount(amount) : "-",
            debit ? "-" : formatAmount(amount),
            formatAmount(Math.abs(balance)),
            debit ? "DB" : "CR",
            "-",
          ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value || "-";
            row.appendChild(cell);
          });
          ledgerEntries.appendChild(row);
        },
      );

      if (transactions.length === 0) {
        showMessage("No ledger entries found for this bank account.");
      }
      entryCountElement.textContent = String(transactions.length);
      debitTotalElement.textContent = formatAmount(debitTotal);
      creditTotalElement.textContent = formatAmount(creditTotal);
      balanceTotalElement.textContent = formatAmount(Math.abs(balance));
    } catch (error) {
      console.error("Error loading bank account ledger:", error);
      showMessage(
        `Unable to load the bank account ledger: ${error.message || "Please check your connection and try again."}`,
      );
    } finally {
      refreshButtons.forEach((button) => {
        button.disabled = false;
      });
    }
  };

  refreshButtons.forEach((button) => {
    button.addEventListener("click", loadLedger);
  });
  await loadLedger();
}

async function loadCustomerLedgerReportPage() {
  const reportDetails = document.getElementById("customerLedgerReportDetails");
  const reportTitle = document.getElementById("customerLedgerReportTitle");
  const reportStatus = document.getElementById("customerLedgerReportStatus");
  const backLink = document.getElementById("customerLedgerReportBack");
  if (!reportDetails || !reportTitle || !reportStatus || !backLink) return;

  const params = new URLSearchParams(window.location.search);
  const contactKey = params.get("contactKey") || "";
  const collection = params.get("collection") || "";
  const entryKey = params.get("entryKey") || "";
  const validCollections = new Set([
    "bookings",
    "cashReceipts",
    "cashPayments",
    "bankReceipts",
    "bankPayments",
    "bankTransfers",
  ]);
  if (!contactKey || !entryKey || !validCollections.has(collection)) {
    reportStatus.textContent =
      "The ledger entry details are missing or invalid.";
    return;
  }

  const ledgerUrl = new URL("customers_ledger.html", window.location.href);
  ledgerUrl.searchParams.set("contactKey", contactKey);
  backLink.href = ledgerUrl.href;
  const footerBackLink = document.getElementById(
    "customerLedgerReportBackFooter",
  );
  if (footerBackLink) footerBackLink.href = ledgerUrl.href;
  reportStatus.textContent = "Loading ledger entry...";

  try {
    const [contactSnapshot, entrySnapshot, contactsSnapshot] =
      await Promise.all([
        getDatabaseSnapshot(`contacts/${contactKey}`),
        getDatabaseSnapshot(`${collection}/${entryKey}`),
        getDatabaseSnapshot("contacts"),
      ]);
    const contact = contactSnapshot.val();
    const entry = entrySnapshot.val();
    if (!contact || !entry) {
      throw new Error("The account or ledger entry could not be found.");
    }

    const entryTypes = {
      bookings: "Booking / Sale",
      cashReceipts: "Cash Receipt",
      cashPayments: "Cash Payment",
      bankReceipts: "Bank Receipt",
      bankPayments: "Bank Payment",
      bankTransfers: "Bank Transfer",
    };
    reportTitle.textContent = entryTypes[collection];
    const contacts = contactsSnapshot.val() || {};
    const normalizeReference = (value) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const resolveAccount = (reference) => {
      const value = String(reference || "").trim();
      if (!value) return null;
      if (contacts[value]) return contacts[value];
      return (
        Object.values(contacts).find(
          (savedContact) =>
            (savedContact &&
              normalizeReference(savedContact.fullName) ===
                normalizeReference(value)) ||
            (savedContact &&
              normalizeReference(savedContact.contactNumber) ===
                normalizeReference(value)),
        ) || null
      );
    };
    const resolveAccountKey = (reference) => {
      const value = String(reference || "").trim();
      if (!value) return "";
      if (contacts[value]) return value;
      const normalizedValue = normalizeReference(value);
      return (
        Object.entries(contacts).find(
          ([, savedContact]) =>
            (savedContact &&
              normalizeReference(savedContact.fullName) === normalizedValue) ||
            (savedContact &&
              normalizeReference(savedContact.contactNumber) ===
                normalizedValue),
        )?.[0] || ""
      );
    };
    const amount = Number.parseFloat(
      String(entry.amount || entry.salePrice || entry.totalFare || "0")
        .replace(/,/g, "")
        .trim(),
    );
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const formatVoucherAmount = (value) =>
      value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const isTransfer = collection === "bankTransfers";
    const isPayment = ["cashPayments", "bankPayments"].includes(collection);
    const isReceipt = ["cashReceipts", "bankReceipts"].includes(collection);
    const isBank = ["bankReceipts", "bankPayments"].includes(collection);
    const customerAccount = resolveAccount(
      entry.customerContactKey || contactKey,
    );
    const bankReference = isTransfer ? "" : isPayment ? entry.from : entry.into;
    const cashBankAccount = entry.bankAccountName
      ? {
          fullName: entry.bankAccountName,
          contactNumber: entry.bankAccountCode || "",
        }
      : resolveAccount(bankReference) || {
          fullName: bankReference || (isBank ? "Bank Account" : "Cash in Hand"),
          contactNumber: "",
        };
    const fromAccount = resolveAccount(entry.from) || {
      fullName: entry.from || "",
      contactNumber: "",
    };
    const toAccount = resolveAccount(entry.to) || {
      fullName: entry.to || "",
      contactNumber: "",
    };
    const selectedIsCustomer =
      entry.customerContactKey === contactKey || collection === "bookings";
    const selectedAccount = selectedIsCustomer
      ? customerAccount || contact
      : cashBankAccount;
    const voucherAccount = isTransfer
      ? fromAccount.fullName
      : cashBankAccount.fullName;
    const accountHeading = document.getElementById(
      "customerLedgerReportAccount",
    );
    if (accountHeading)
      accountHeading.value = voucherAccount || contact.fullName || "";

    const referenceInput = document.getElementById(
      "customerLedgerReportReference",
    );
    if (referenceInput) {
      referenceInput.value =
        entry.reference || entry.transNo || entry.ticketno || entryKey;
    }
    const dateInput = document.getElementById("customerLedgerReportDate");
    if (dateInput) {
      const dateValue = entry.date || entry.datetime || entry.timestamp || "";
      const parsedDate = new Date(dateValue);
      dateInput.value =
        dateValue && !Number.isNaN(parsedDate.getTime())
          ? parsedDate.toLocaleDateString()
          : "";
    }
    const debitTotalElement = document.getElementById(
      "customerLedgerReportDebitTotal",
    );
    const creditTotalElement = document.getElementById(
      "customerLedgerReportCreditTotal",
    );
    if (debitTotalElement) {
      debitTotalElement.textContent = formatVoucherAmount(safeAmount);
    }
    if (creditTotalElement) {
      creditTotalElement.textContent = formatVoucherAmount(safeAmount);
    }
    const createdBy = document.getElementById("customerLedgerReportCreatedBy");
    if (createdBy) createdBy.textContent = entry.createdBy || "-";
    const timestampElement = document.getElementById(
      "customerLedgerReportTimestamp",
    );
    if (timestampElement) {
      const timestamp = Number(entry.timestamp);
      timestampElement.textContent =
        Number.isFinite(timestamp) && timestamp > 0
          ? new Date(timestamp).toLocaleString()
          : "-";
    }

    reportDetails.replaceChildren();
    const addVoucherRow = (account, side, description, accountKey) => {
      const row = document.createElement("tr");
      row.dataset.accountKey = accountKey || contactKey;
      row.tabIndex = 0;
      row.setAttribute(
        "aria-label",
        `Open ${account.fullName || "account"} ledger`,
      );
      row.dataset.side = side;
      [
        account.contactNumber || account.contactNo || account.fullName || "-",
        side,
        description || entry.memo || entry.remarks || entryTypes[collection],
        "0",
        entry.reference || "-",
        entry.chequeNumber || "-",
        formatVoucherAmount(safeAmount),
        entry.date || "-",
        "-",
        entry.crNumber || "-",
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
      });
      const ledgerCell = document.createElement("td");
      const ledgerButton = document.createElement("button");
      ledgerButton.type = "button";
      ledgerButton.className = "voucher-ledger-button";
      ledgerButton.textContent = "Open Ledger";
      ledgerButton.setAttribute(
        "aria-label",
        `Open ledger for ${account.fullName || "account"}`,
      );
      ledgerCell.appendChild(ledgerButton);
      row.appendChild(ledgerCell);
      reportDetails.appendChild(row);
    };

    const description = entry.memo || entry.remarks || entryTypes[collection];
    if (isTransfer) {
      addVoucherRow(toAccount, "DB", description, resolveAccountKey(entry.to));
      addVoucherRow(
        fromAccount,
        "CR",
        description,
        resolveAccountKey(entry.from),
      );
    } else if (isReceipt || isPayment) {
      addVoucherRow(
        customerAccount || contact,
        isReceipt ? "CR" : "DB",
        description,
        entry.customerContactKey || contactKey,
      );
      addVoucherRow(
        cashBankAccount,
        isReceipt ? "DB" : "CR",
        description,
        resolveAccountKey(bankReference) || contactKey,
      );
    } else {
      addVoucherRow(selectedAccount || contact, "DB", description, contactKey);
      addVoucherRow(
        { fullName: "Sales / Income", contactNumber: "" },
        "CR",
        description,
        contactKey,
      );
    }
    reportStatus.textContent = "";

    const openVoucherAccountLedger = (row) => {
      const accountKey = row?.dataset.accountKey;
      if (!accountKey) return;
      const accountLedgerUrl = new URL(
        "customers_ledger.html",
        window.location.href,
      );
      accountLedgerUrl.searchParams.set("contactKey", accountKey);
      window.location.href = accountLedgerUrl.href;
    };
    const selectVoucherRow = (row) => {
      if (!row) return;
      reportDetails
        .querySelectorAll("tr[data-account-key]")
        .forEach((accountRow) => {
          const isSelected = accountRow === row;
          accountRow.classList.toggle("selected", isSelected);
          accountRow.setAttribute("aria-selected", String(isSelected));
        });
      row.focus();
    };
    reportDetails.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-account-key]");
      if (!row) return;
      if (event.target.closest(".voucher-ledger-button")) {
        openVoucherAccountLedger(row);
        return;
      }
      selectVoucherRow(row);
    });
    reportDetails.addEventListener("dblclick", (event) => {
      const row = event.target.closest("tr[data-account-key]");
      if (row) openVoucherAccountLedger(row);
    });
    reportDetails.addEventListener("keydown", (event) => {
      const rows = [...reportDetails.querySelectorAll("tr[data-account-key]")];
      if (!rows.length) return;
      const currentRow = event.target.closest("tr[data-account-key]");
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = rows.indexOf(currentRow);
        const nextIndex =
          currentIndex < 0
            ? 0
            : (currentIndex +
                (event.key === "ArrowDown" ? 1 : -1) +
                rows.length) %
              rows.length;
        selectVoucherRow(rows[nextIndex]);
        return;
      }
      if (event.key === "Enter" && currentRow) {
        event.preventDefault();
        openVoucherAccountLedger(currentRow);
      }
    });
  } catch (error) {
    console.error("Error loading customer ledger report:", error);
    reportStatus.textContent = `Unable to load this ledger entry: ${error.message || "Please try again."}`;
  }
}

async function loadCashReceiptSourceOptions() {
  const sourceSelect = document.getElementById("receiptFrom");
  if (!sourceSelect) return;
  const nameField = document.getElementById("receiptNameField");

  const sourceOptions = {
    customer: {
      field: document.getElementById("receiptCustomerField"),
      select: document.getElementById("receiptCustomer"),
      search: document.getElementById("receiptCustomerSearch"),
      placeholder: "Select a customer",
      loading: "Loading customers...",
      empty: "No New Customer contacts found",
      error: "Unable to load customers. Please try again.",
      path: "contacts",
      getOptions: (records) =>
        Object.entries(records)
          .filter(
            ([, contact]) =>
              contact &&
              String(contact.accountCategory || "")
                .trim()
                .toLowerCase() === "new customer",
          )
          .map(([key, contact]) => ({
            value: key,
            accountCode: contact.contactNumber || "",
            label: [contact.contactNumber, contact.fullName, contact.contactNo]
              .filter(Boolean)
              .join(" - "),
            sort: contact.fullName || "",
            searchText: [
              contact.contactNumber,
              contact.contactNo,
              contact.fullName,
              contact.passportNo,
              contact.passportNumber,
              contact.documentType?.trim().toLowerCase() === "passport"
                ? contact.documentNo
                : "",
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase(),
          })),
    },
    supplier: {
      field: document.getElementById("receiptSupplierField"),
      select: document.getElementById("receiptSupplier"),
      placeholder: "Select a supplier",
      loading: "Loading suppliers...",
      empty: "No suppliers found",
      error: "Unable to load suppliers. Please try again.",
      path: "contacts",
      getOptions: (records) =>
        Object.entries(records)
          .filter(
            ([, contact]) =>
              contact &&
              String(contact.accountCategory || "")
                .trim()
                .toLowerCase() === "new vendor",
          )
          .map(([key, vendor]) => ({
            value: key,
            label: [vendor.fullName, vendor.contactNo]
              .filter(Boolean)
              .join(" - "),
            sort: vendor.fullName || "",
          })),
    },
  };

  let requestId = 0;
  let customerOptions = [];
  const customerSearch = sourceOptions.customer.search;
  const customerSelect = sourceOptions.customer.select;
  const updateAccountCodes = (accountCode = "") => {
    document
      .querySelectorAll(
        '[aria-labelledby="depositItemsHeading"] [aria-label="Account code"]',
      )
      .forEach((input) => {
        input.value = accountCode;
      });
  };
  const renderCustomerOptions = (
    selectedValue = customerSelect?.value || "",
  ) => {
    if (!customerSelect) return;
    const query = String(customerSearch?.value || "")
      .trim()
      .toLowerCase();
    const filteredOptions = query
      ? customerOptions.filter(({ searchText }) => searchText.includes(query))
      : customerOptions;
    const placeholder =
      filteredOptions.length > 0
        ? sourceOptions.customer.placeholder
        : query
          ? "No matching customers found"
          : sourceOptions.customer.empty;

    customerSelect.replaceChildren(new Option(placeholder, ""));
    filteredOptions.forEach(({ value, label, accountCode }) => {
      const option = new Option(label, value);
      option.dataset.accountCode = accountCode;
      customerSelect.add(option);
    });
    customerSelect.value = selectedValue;
  };

  customerSearch?.addEventListener("input", renderCustomerOptions);
  customerSelect?.addEventListener("change", () => {
    const selectedValue = customerSelect.value;
    updateAccountCodes(
      customerSelect.selectedOptions[0]?.dataset.accountCode || "",
    );
    if (customerSearch?.value) {
      customerSearch.value = "";
      renderCustomerOptions(selectedValue);
    }
  });

  sourceSelect.addEventListener("change", async () => {
    const selectedSource = sourceSelect.value;
    updateAccountCodes();
    Object.values(sourceOptions).forEach(({ field }) => {
      if (field) field.hidden = true;
    });
    if (nameField) nameField.hidden = true;

    if (selectedSource === "employee") {
      requestId += 1;
      return;
    }

    if (selectedSource === "cash-in-hand") {
      requestId += 1;
      return;
    }

    if (
      selectedSource === "miscellaneous" ||
      selectedSource === "quick-entry"
    ) {
      requestId += 1;
      if (nameField) nameField.hidden = false;
      return;
    }

    const config = sourceOptions[selectedSource];
    if (!config?.field || !config.select) return;
    config.field.hidden = false;
    const currentRequest = ++requestId;
    config.select.disabled = true;
    if (config.search) {
      config.search.disabled = true;
      config.search.value = "";
    }
    config.select.replaceChildren(new Option(config.loading, ""));

    try {
      const snapshot = await getDatabaseSnapshot(config.path);
      if (currentRequest !== requestId || sourceSelect.value !== selectedSource)
        return;
      const options = config
        .getOptions(snapshot.val() || {})
        .sort((first, second) => first.sort.localeCompare(second.sort));
      if (selectedSource === "customer") {
        customerOptions = options;
        renderCustomerOptions();
      } else {
        config.select.replaceChildren(
          new Option(options.length ? config.placeholder : config.empty, ""),
        );
        options.forEach(({ value, label }) => {
          config.select.add(new Option(label, value));
        });
      }
      config.select.disabled = options.length === 0;
      if (config.search) config.search.disabled = options.length === 0;
    } catch (error) {
      console.error(`Error loading cash receipt ${selectedSource}s:`, error);
      if (currentRequest !== requestId) return;
      if (config.search) config.search.disabled = true;
      config.select.replaceChildren(new Option(config.error, ""));
    }
  });

  if (
    window.location.pathname.endsWith("cash_payment.html") ||
    window.location.pathname.endsWith("bank_received.html") ||
    window.location.pathname.endsWith("bank_payment.html")
  ) {
    sourceSelect.dispatchEvent(new Event("change"));
  }
}

async function initializeBankReceiptAccounts() {
  const bankSelect = document.getElementById("receiptInto");
  if (
    !bankSelect ||
    !["bank_received.html", "bank_payment.html"].includes(
      window.location.pathname.split("/").pop(),
    )
  )
    return;

  bankSelect.disabled = true;
  bankSelect.replaceChildren(new Option("Loading bank accounts...", ""));

  try {
    const snapshot = await getDatabaseSnapshot("contacts");
    const accounts = Object.entries(snapshot.val() || {})
      .filter(
        ([, contact]) =>
          contact &&
          String(contact.accountCategory || "")
            .trim()
            .toLowerCase() === "new bank account" &&
          contact.fullName,
      )
      .map(([key, contact]) => ({
        key,
        contact,
        label: [contact.contactNumber, contact.fullName, contact.contactNo]
          .filter(Boolean)
          .join(" - "),
      }))
      .sort((first, second) =>
        String(first.contact.fullName).localeCompare(
          String(second.contact.fullName),
        ),
      );

    bankSelect.replaceChildren(
      new Option(
        accounts.length
          ? "Select a bank account"
          : "No saved bank accounts found",
        "",
      ),
    );
    accounts.forEach(({ key, label }) => {
      bankSelect.add(new Option(label, key));
    });
    bankSelect.disabled = accounts.length === 0;
    bankSelect.addEventListener("change", () => {
      updateBankReceiptBalance();
    });
    document
      .getElementById("receiptFrom")
      ?.addEventListener("change", updateBankReceivedCashBalanceVisibility);
    updateBankReceivedCashBalanceVisibility();
    updateBankReceiptBalance();
  } catch (error) {
    console.error("Error loading bank receipt accounts:", error);
    bankSelect.replaceChildren(new Option("Unable to load bank accounts", ""));
    bankSelect.disabled = true;
    const balanceElement = document.getElementById(
      window.location.pathname.endsWith("bank_payment.html")
        ? "bankPaymentBalance"
        : "bankReceiptBalance",
    );
    if (balanceElement) {
      balanceElement.textContent = "Unable to load";
    }
  }
}

function updateBankReceivedCashBalanceVisibility() {
  if (!window.location.pathname.endsWith("bank_received.html")) return;
  const sourceSelect = document.getElementById("receiptFrom");
  const cashBalanceField = document.getElementById(
    "bankReceiptCashBalanceField",
  );
  if (!sourceSelect || !cashBalanceField) return;

  const cashInHandSelected = sourceSelect.value === "cash-in-hand";
  cashBalanceField.hidden = !cashInHandSelected;
  if (cashInHandSelected) updateBankReceivedCashBalance();
}

async function updateBankReceivedCashBalance() {
  const balanceElement = document.getElementById("bankReceiptCashBalance");
  if (!balanceElement) return;

  balanceElement.textContent = "Loading...";
  try {
    const [
      cashReceiptsSnapshot,
      cashPaymentsSnapshot,
      bankPaymentsSnapshot,
      bankReceiptsSnapshot,
    ] = await Promise.all([
      getDatabaseSnapshot("cashReceipts"),
      getDatabaseSnapshot("cashPayments"),
      getDatabaseSnapshot("bankPayments"),
      getDatabaseSnapshot("bankReceipts"),
    ]);
    const amountFor = (record) => {
      const amount = Number.parseFloat(
        String(record?.amount || "0")
          .replace(/,/g, "")
          .trim(),
      );
      return Number.isFinite(amount) ? amount : 0;
    };
    const cashReceived = Object.values(cashReceiptsSnapshot.val() || {}).reduce(
      (total, receipt) =>
        !receipt.into || receipt.into === "Cash in Hand"
          ? total + amountFor(receipt)
          : total,
      0,
    );
    const cashPaid = Object.values(cashPaymentsSnapshot.val() || {}).reduce(
      (total, payment) =>
        !payment.from || payment.from === "Cash in Hand"
          ? total + amountFor(payment)
          : total,
      0,
    );
    const receivedFromBanks = Object.values(
      bankPaymentsSnapshot.val() || {},
    ).reduce(
      (total, payment) =>
        payment.to === "Cash in Hand" || payment.toCashInHand === true
          ? total + amountFor(payment)
          : total,
      0,
    );
    const depositedToBanks = Object.values(
      bankReceiptsSnapshot.val() || {},
    ).reduce(
      (total, receipt) =>
        receipt.fromCashInHand === true || receipt.source === "cash-in-hand"
          ? total + amountFor(receipt)
          : total,
      0,
    );
    balanceElement.textContent = (
      cashReceived +
      receivedFromBanks -
      cashPaid -
      depositedToBanks
    ).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    console.error(
      "Error loading cash-in-hand balance for bank receipt:",
      error,
    );
    balanceElement.textContent = "Unable to load";
  }
}

function updateBankReceiptBalance() {
  const bankSelect = document.getElementById("receiptInto");
  const isBankPayment = window.location.pathname.endsWith("bank_payment.html");
  const balanceElement = document.getElementById(
    isBankPayment ? "bankPaymentBalance" : "bankReceiptBalance",
  );
  if (!bankSelect || !balanceElement) return;

  const bankKey = bankSelect.value;
  if (!bankKey) {
    balanceElement.textContent = "Select a bank account";
    return;
  }

  Promise.all([
    getDatabaseSnapshot("bankReceipts"),
    getDatabaseSnapshot("bankPayments"),
    getDatabaseSnapshot("bankTransfers"),
  ])
    .then(([receiptsSnapshot, paymentsSnapshot, transfersSnapshot]) => {
      const received = Object.values(receiptsSnapshot.val() || {}).reduce(
        (total, receipt) =>
          receipt.into === bankKey && Number.isFinite(Number(receipt.amount))
            ? total + Number(receipt.amount)
            : total,
        0,
      );
      const paid = Object.values(paymentsSnapshot.val() || {}).reduce(
        (total, payment) =>
          payment.from === bankKey && Number.isFinite(Number(payment.amount))
            ? total + Number(payment.amount)
            : total,
        0,
      );
      const transfers = Object.values(transfersSnapshot.val() || {});
      const transferredIn = transfers.reduce(
        (total, transfer) =>
          transfer.to === bankKey && Number.isFinite(Number(transfer.amount))
            ? total + Number(transfer.amount)
            : total,
        0,
      );
      const transferredOut = transfers.reduce(
        (total, transfer) =>
          transfer.from === bankKey && Number.isFinite(Number(transfer.amount))
            ? total + Number(transfer.amount)
            : total,
        0,
      );
      const balance = received + transferredIn - paid - transferredOut;
      balanceElement.textContent = balance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    })
    .catch((error) => {
      console.error("Error loading selected bank balance:", error);
      balanceElement.textContent = "Unable to load";
    });
}

async function initializeDayBookSummary() {
  const dateInput = document.getElementById("dayBookDate");
  if (!dateInput) return;

  const status = document.getElementById("dayBookStatus");
  const tableBody = document.getElementById("dayBookEntries");
  const bankAccountsElement = document.getElementById("dayBookBankAccounts");
  const receiptTotalElement = document.getElementById("dayBookReceiptTotal");
  const paymentTotalElement = document.getElementById("dayBookPaymentTotal");
  const valueElements = {
    cashOpening: document.getElementById("dayBookCashOpening"),
    cashBalance: document.getElementById("dayBookCashBalance"),
    bankBalance: document.getElementById("dayBookBankBalance"),
    totalBalance: document.getElementById("dayBookTotalBalance"),
    profitToday: document.getElementById("dayBookProfitToday"),
    expenseToday: document.getElementById("dayBookExpenseToday"),
    monthProfit: document.getElementById("dayBookMonthProfit"),
    monthExpense: document.getElementById("dayBookMonthExpense"),
    monthNet: document.getElementById("dayBookMonthNet"),
  };
  const dateKeyFor = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (!dateInput.value) dateInput.value = dateKeyFor(new Date());

  const parseAmount = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const amount = Number.parseFloat(String(value).replace(/,/g, "").trim());
    return Number.isFinite(amount) ? amount : null;
  };
  const formatAmount = (amount, positiveLabel = "DB") => {
    const negativeLabel = positiveLabel === "DB" ? "CR" : "DB";
    return `${Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${amount < 0 ? negativeLabel : positiveLabel}`;
  };
  const recordDateKey = (record) => {
    const rawDate = record?.date || record?.datetime;
    if (typeof rawDate === "string") {
      const isoDate = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoDate) return isoDate[1];
      const parsedDate = new Date(rawDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        return dateKeyFor(parsedDate);
      }
    }

    const timestamp = Number(record?.timestamp);
    return Number.isFinite(timestamp) && timestamp > 0
      ? dateKeyFor(new Date(timestamp))
      : "";
  };
  const bookingDateKey = (booking) => {
    if (booking?.date) return recordDateKey({ date: booking.date });
    const timestamp = Number(booking?.timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      return dateKeyFor(new Date(timestamp));
    }
    return recordDateKey(booking);
  };
  const isOnOrBefore = (record, dateKey) => {
    const recordDate = recordDateKey(record);
    return recordDate !== "" && recordDate <= dateKey;
  };
  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const contactsSnapshot = await getDatabaseSnapshot("contacts");
  const [
    cashReceiptsSnapshot,
    cashPaymentsSnapshot,
    bankReceiptsSnapshot,
    bankPaymentsSnapshot,
    bankTransfersSnapshot,
    bookingsSnapshot,
  ] = await Promise.all([
    getDatabaseSnapshot("cashReceipts"),
    getDatabaseSnapshot("cashPayments"),
    getDatabaseSnapshot("bankReceipts"),
    getDatabaseSnapshot("bankPayments"),
    getDatabaseSnapshot("bankTransfers"),
    getDatabaseSnapshot("bookings"),
  ]);
  const contacts = contactsSnapshot.val() || {};
  const cashReceipts = Object.values(cashReceiptsSnapshot.val() || {});
  const cashPayments = Object.values(cashPaymentsSnapshot.val() || {});
  const bankReceipts = Object.values(bankReceiptsSnapshot.val() || {});
  const bankPayments = Object.values(bankPaymentsSnapshot.val() || {});
  const bankTransfers = Object.values(bankTransfersSnapshot.val() || {});
  const bookings = Object.values(bookingsSnapshot.val() || {});
  const resolveBankKey = (reference) => {
    const value = String(reference || "").trim();
    if (!value) return "";
    const normalizedReference = normalize(value);
    if (
      contacts[value] &&
      normalize(contacts[value].accountCategory) === "new bank account"
    ) {
      return value;
    }
    return (
      Object.entries(contacts).find(
        ([, contact]) =>
          contact &&
          normalize(contact.accountCategory) === "new bank account" &&
          (normalize(contact.fullName) === normalizedReference ||
            normalize(contact.contactNumber) === normalizedReference),
      )?.[0] || ""
    );
  };
  const isCashAccount = (reference) =>
    !String(reference || "").trim() || normalize(reference) === "cash in hand";
  const accountFor = (reference, fallbackName = "", fallbackCode = "") => {
    const value = String(reference || "").trim();
    const normalizedReference = normalize(value);
    const contactEntry =
      contacts[value] !== undefined
        ? [value, contacts[value]]
        : Object.entries(contacts).find(
            ([, candidate]) =>
              candidate &&
              (normalize(candidate.fullName) === normalizedReference ||
                normalize(candidate.contactNumber) === normalizedReference),
          );
    const contact = contactEntry?.[1];
    return {
      code:
        contact?.contactNumber ||
        contact?.accountCode ||
        fallbackCode ||
        (contact ? "" : /^\d+$/.test(value) ? value : ""),
      name: contact?.fullName || fallbackName || value || "Account",
      contactKey: contactEntry?.[0] || "",
      accountCategory: contact?.accountCategory || "",
    };
  };
  const ledgerTargetFor = (account) => {
    if (normalize(account.name) === "cash in hand") {
      return { type: "cash-in-hand", key: "" };
    }
    if (
      normalize(account.accountCategory) === "new bank account" &&
      account.contactKey
    ) {
      return { type: "bank", key: account.contactKey };
    }
    if (account.contactKey) {
      return { type: "contact", key: account.contactKey };
    }
    return { type: "", key: "" };
  };
  const cashAccountReference =
    Object.entries(contacts).find(
      ([, contact]) =>
        contact && normalize(contact.fullName) === "cash in hand",
    )?.[0] || "Cash in Hand";
  const cashAccount = accountFor(cashAccountReference, "Cash in Hand");
  const formatTableAmount = (amount) =>
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const getEntryNumber = (record, key) =>
    record.reference || record.transNo || record.ticketno || key.slice(-6);
  const getRecordTime = (record, key) => {
    const timestamp = Number(record.timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
    const dateKey = recordDateKey(record);
    return dateKey ? Date.parse(`${dateKey}T00:00:00`) : key;
  };

  const render = () => {
    const selectedDate = dateInput.value;
    if (!selectedDate) return;
    const monthStart = `${selectedDate.slice(0, 7)}-01`;
    const dailyEntries = [];
    const addEntryPair = ({
      type,
      number,
      date,
      firstAccount,
      secondAccount,
      description,
      amount,
      firstIsReceipt,
      sortTime,
    }) => {
      const validAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;
      dailyEntries.push(
        {
          type,
          number,
          date,
          code: firstAccount.code,
          account: firstAccount.name,
          ledgerTarget: ledgerTargetFor(firstAccount),
          description,
          receipts: firstIsReceipt ? validAmount : 0,
          payments: firstIsReceipt ? 0 : validAmount,
          sortTime,
        },
        {
          type: "",
          number: "",
          date,
          code: secondAccount.code,
          account: secondAccount.name,
          ledgerTarget: ledgerTargetFor(secondAccount),
          description,
          receipts: firstIsReceipt ? 0 : validAmount,
          payments: firstIsReceipt ? validAmount : 0,
          sortTime,
        },
      );
    };
    const appendVoucherEntries = (records, type, direction) => {
      Object.entries(records || {}).forEach(([key, record]) => {
        if (!record || recordDateKey(record) !== selectedDate) return;
        const amount = parseAmount(record.amount);
        if (amount === null) return;
        const customerAccount = accountFor(
          record.customerContactKey || record.customerName,
          record.customerName || record.customerCode || "Customer",
          record.customerCode || record.accountCode,
        );
        const bankAccount = accountFor(
          record.into || record.from || record.bankAccountCode,
          record.bankAccountName || record.intoName || record.fromName,
          record.bankAccountCode,
        );
        const usesBank = type === "BR" || type === "BP";
        const moneyAccount = usesBank ? bankAccount : cashAccount;
        const isReceipt = direction === "receipt";
        const date = recordDateKey(record);
        addEntryPair({
          type,
          number: getEntryNumber(record, key),
          date,
          firstAccount: isReceipt ? moneyAccount : customerAccount,
          secondAccount: isReceipt ? customerAccount : moneyAccount,
          description:
            record.memo ||
            `${type === "CR" || type === "BR" ? "Received from" : "Paid to"} ${customerAccount.name}`,
          amount,
          firstIsReceipt: isReceipt,
          sortTime: getRecordTime(record, key),
        });
      });
    };

    appendVoucherEntries(cashReceiptsSnapshot.val() || {}, "CR", "receipt");
    appendVoucherEntries(cashPaymentsSnapshot.val() || {}, "CP", "payment");
    appendVoucherEntries(bankReceiptsSnapshot.val() || {}, "BR", "receipt");
    appendVoucherEntries(bankPaymentsSnapshot.val() || {}, "BP", "payment");
    Object.entries(bankTransfersSnapshot.val() || {}).forEach(
      ([key, transfer]) => {
        if (!transfer || recordDateKey(transfer) !== selectedDate) return;
        const amount = parseAmount(transfer.amount);
        if (amount === null) return;
        addEntryPair({
          type: "BT",
          number: getEntryNumber(transfer, key),
          date: recordDateKey(transfer),
          firstAccount: accountFor(
            transfer.to,
            transfer.toName,
            transfer.toCode,
          ),
          secondAccount: accountFor(
            transfer.from,
            transfer.fromName,
            transfer.fromCode,
          ),
          description: transfer.memo || "Bank transfer",
          amount,
          firstIsReceipt: true,
          sortTime: getRecordTime(transfer, key),
        });
      },
    );
    Object.entries(bookingsSnapshot.val() || {}).forEach(([key, booking]) => {
      if (!booking || bookingDateKey(booking) !== selectedDate) return;
      const salePrice = parseAmount(booking.salePrice);
      const totalFare = parseAmount(booking.totalFare);
      const fare = parseAmount(booking.fare);
      const taxes = parseAmount(booking.taxes);
      const cost = totalFare ?? (fare ?? 0) + (taxes ?? 0);
      if (salePrice === null && cost === 0) return;
      const customerContactKey =
        booking.customerContactKey ||
        Object.entries(contacts).find(
          ([, contact]) =>
            contact &&
            normalize(contact.contactNo) === normalize(booking.contactNo),
        )?.[0];
      const customer = accountFor(
        customerContactKey,
        [booking.surname, booking.givenName].filter(Boolean).join(" ") ||
          booking.contactNo ||
          "Ticket sale",
      );
      const airline = accountFor(
        booking.agent,
        booking.carrier || "Ticket cost",
      );
      const description =
        booking.remarks ||
        [booking.route, booking.pnr].filter(Boolean).join(" - ") ||
        "Ticket booking";
      const entryNumber = getEntryNumber(booking, key);
      const sortTime = getRecordTime(booking, key);
      if (salePrice !== null) {
        dailyEntries.push({
          type: "SALE",
          number: entryNumber,
          date: bookingDateKey(booking),
          code: customer.code,
          account: customer.name,
          ledgerTarget: ledgerTargetFor(customer),
          description,
          receipts: salePrice,
          payments: 0,
          sortTime,
        });
      }
      if (cost > 0) {
        dailyEntries.push({
          type: "",
          number: entryNumber,
          date: bookingDateKey(booking),
          code: airline.code,
          account: airline.name,
          ledgerTarget: ledgerTargetFor(airline),
          description,
          receipts: 0,
          payments: cost,
          sortTime,
        });
      }
    });
    dailyEntries.sort((first, second) => {
      if (
        typeof first.sortTime === "number" &&
        typeof second.sortTime === "number"
      ) {
        return first.sortTime - second.sortTime;
      }
      return String(first.sortTime).localeCompare(String(second.sortTime));
    });
    if (tableBody) {
      tableBody.replaceChildren();
      if (dailyEntries.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.textContent = "No entries found for this date.";
      } else {
        dailyEntries.forEach((entry) => {
          const row = tableBody.insertRow();
          row.tabIndex = 0;
          row.dataset.ledgerType = entry.ledgerTarget.type;
          row.dataset.ledgerKey = entry.ledgerTarget.key;
          [
            entry.type,
            entry.number,
            entry.code,
            entry.account,
            entry.description,
            entry.receipts ? formatTableAmount(entry.receipts) : "",
            entry.payments ? formatTableAmount(entry.payments) : "",
          ].forEach((value) => {
            row.insertCell().textContent = value || "";
          });
        });
      }
    }
    const dailyReceiptTotal = dailyEntries.reduce(
      (total, entry) => total + entry.receipts,
      0,
    );
    const dailyPaymentTotal = dailyEntries.reduce(
      (total, entry) => total + entry.payments,
      0,
    );
    if (receiptTotalElement) {
      receiptTotalElement.textContent = formatTableAmount(dailyReceiptTotal);
    }
    if (paymentTotalElement) {
      paymentTotalElement.textContent = formatTableAmount(dailyPaymentTotal);
    }

    let cashOpening = 0;
    let cashBalance = 0;

    cashReceipts.forEach((receipt) => {
      if (!isCashAccount(receipt.into)) return;
      const amount = parseAmount(receipt.amount) || 0;
      const transactionDate = recordDateKey(receipt);
      if (transactionDate && transactionDate < selectedDate) {
        cashOpening += amount;
      }
      if (isOnOrBefore(receipt, selectedDate)) cashBalance += amount;
    });
    cashPayments.forEach((payment) => {
      if (!isCashAccount(payment.from)) return;
      const amount = parseAmount(payment.amount) || 0;
      const transactionDate = recordDateKey(payment);
      if (transactionDate && transactionDate < selectedDate) {
        cashOpening -= amount;
      }
      if (isOnOrBefore(payment, selectedDate)) cashBalance -= amount;
    });
    bankReceipts.forEach((receipt) => {
      if (
        receipt.fromCashInHand !== true &&
        receipt.source !== "cash-in-hand"
      ) {
        return;
      }
      const amount = parseAmount(receipt.amount) || 0;
      const transactionDate = recordDateKey(receipt);
      if (transactionDate && transactionDate < selectedDate) {
        cashOpening -= amount;
      }
      if (isOnOrBefore(receipt, selectedDate)) cashBalance -= amount;
    });
    bankPayments.forEach((payment) => {
      if (payment.to !== "Cash in Hand" && payment.toCashInHand !== true) {
        return;
      }
      const amount = parseAmount(payment.amount) || 0;
      const transactionDate = recordDateKey(payment);
      if (transactionDate && transactionDate < selectedDate) {
        cashOpening += amount;
      }
      if (isOnOrBefore(payment, selectedDate)) cashBalance += amount;
    });

    const bankBalances = new Map(
      Object.entries(contacts)
        .filter(
          ([, contact]) =>
            contact &&
            normalize(contact.accountCategory) === "new bank account",
        )
        .map(([key]) => [key, 0]),
    );
    const applyBankTransaction = (reference, amount, direction) => {
      const key = resolveBankKey(reference);
      if (key && bankBalances.has(key)) {
        bankBalances.set(key, bankBalances.get(key) + direction * amount);
      }
    };
    bankReceipts.forEach((receipt) => {
      if (isOnOrBefore(receipt, selectedDate)) {
        applyBankTransaction(
          receipt.into || receipt.bankAccountCode || receipt.bankAccountName,
          parseAmount(receipt.amount) || 0,
          1,
        );
      }
    });
    bankPayments.forEach((payment) => {
      if (isOnOrBefore(payment, selectedDate)) {
        applyBankTransaction(
          payment.from || payment.bankAccountCode || payment.bankAccountName,
          parseAmount(payment.amount) || 0,
          -1,
        );
      }
    });
    bankTransfers.forEach((transfer) => {
      if (!isOnOrBefore(transfer, selectedDate)) return;
      const amount = parseAmount(transfer.amount) || 0;
      applyBankTransaction(transfer.from, amount, -1);
      applyBankTransaction(transfer.to, amount, 1);
    });
    const bankBalance = [...bankBalances.values()].reduce(
      (total, balance) => total + balance,
      0,
    );
    if (bankAccountsElement) {
      bankAccountsElement.replaceChildren();
      [...bankBalances.entries()]
        .sort(([firstKey], [secondKey]) =>
          String(contacts[firstKey]?.fullName || "").localeCompare(
            String(contacts[secondKey]?.fullName || ""),
          ),
        )
        .forEach(([key, balance]) => {
          const contact = contacts[key];
          const card = document.createElement("div");
          card.className = "bank-account-balance";
          const title = document.createElement("div");
          title.className = "summary-title";
          title.textContent = contact?.fullName || "Bank Account";
          title.title = contact?.fullName || "Bank Account";
          const value = document.createElement("div");
          value.className = "summary-value";
          value.textContent = formatAmount(balance);
          card.append(title, value);
          bankAccountsElement.appendChild(card);
        });
    }

    const bookingTotals = (matchesDate) =>
      bookings.reduce(
        (totals, booking) => {
          const bookingDate = bookingDateKey(booking);
          if (!bookingDate || !matchesDate(bookingDate)) return totals;

          const salePrice = parseAmount(booking.salePrice);
          if (salePrice === null) return totals;
          const totalFare = parseAmount(booking.totalFare);
          const fare = parseAmount(booking.fare);
          const taxes = parseAmount(booking.taxes);
          const cost = totalFare ?? (fare ?? 0) + (taxes ?? 0);
          totals.expenses += cost;
          totals.profit += salePrice - cost;
          return totals;
        },
        { expenses: 0, profit: 0 },
      );
    const todayTotals = bookingTotals(
      (bookingDate) => bookingDate === selectedDate,
    );
    const monthTotals = bookingTotals(
      (bookingDate) => bookingDate >= monthStart && bookingDate <= selectedDate,
    );
    const amounts = {
      cashOpening,
      cashBalance,
      bankBalance,
      totalBalance: cashBalance + bankBalance,
      profitToday: todayTotals.profit,
      expenseToday: todayTotals.expenses,
      monthProfit: monthTotals.profit,
      monthExpense: monthTotals.expenses,
      monthNet: monthTotals.profit,
    };
    Object.entries(amounts).forEach(([key, amount]) => {
      const positiveLabel = ["profitToday", "monthProfit", "monthNet"].includes(
        key,
      )
        ? "CR"
        : "DB";
      if (valueElements[key]) {
        valueElements[key].textContent = formatAmount(amount, positiveLabel);
      }
    });

    const selectedDateLabel = new Date(`${selectedDate}T00:00:00`);
    const monthLabel = selectedDateLabel.toLocaleString("en-US", {
      month: "short",
    });
    const dateLabel = selectedDateLabel.toLocaleDateString("en-GB");
    document.getElementById("dayBookMonthProfitTitle").textContent =
      `Profit ${monthLabel} Upto ${dateLabel}`;
    document.getElementById("dayBookMonthExpenseTitle").textContent =
      `Expenses ${monthLabel} Upto ${dateLabel}`;
    document.getElementById("dayBookMonthNetTitle").textContent =
      `Net P&L ${monthLabel} Upto ${dateLabel}`;
  };

  let selectedDayBookRow = null;
  const selectDayBookRow = (row) => {
    if (!row || !tableBody.contains(row)) return;
    tableBody.querySelectorAll("tr[data-ledger-type]").forEach((entryRow) => {
      const isSelected = entryRow === row;
      entryRow.classList.toggle("selected", isSelected);
      entryRow.setAttribute("aria-selected", String(isSelected));
    });
    selectedDayBookRow = row;
    row.focus();
  };
  const openDayBookLedger = (row) => {
    if (!row?.dataset.ledgerType) return;
    const ledgerUrl = new URL("customers_ledger.html", window.location.href);
    if (row.dataset.ledgerType === "cash-in-hand") {
      ledgerUrl.searchParams.set("account", "cash-in-hand");
    } else if (row.dataset.ledgerType === "bank") {
      ledgerUrl.searchParams.set("account", "bank");
      ledgerUrl.searchParams.set("bankKey", row.dataset.ledgerKey);
    } else {
      ledgerUrl.searchParams.set("contactKey", row.dataset.ledgerKey);
    }
    window.location.href = ledgerUrl.href;
  };
  tableBody?.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-ledger-type]");
    if (row) selectDayBookRow(row);
  });
  tableBody?.addEventListener("dblclick", (event) => {
    const row = event.target.closest("tr[data-ledger-type]");
    if (row) openDayBookLedger(row);
  });
  tableBody?.addEventListener("keydown", (event) => {
    const rows = [...tableBody.querySelectorAll("tr[data-ledger-type]")];
    if (!rows.length) return;
    const currentRow =
      event.target.closest("tr[data-ledger-type]") || selectedDayBookRow;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = rows.indexOf(currentRow);
      const nextIndex =
        currentIndex < 0
          ? event.key === "ArrowDown"
            ? 0
            : rows.length - 1
          : (currentIndex +
              (event.key === "ArrowDown" ? 1 : -1) +
              rows.length) %
            rows.length;
      selectDayBookRow(rows[nextIndex]);
      return;
    }
    if (event.key === "Enter" && currentRow) {
      event.preventDefault();
      openDayBookLedger(currentRow);
    }
  });

  render();
  dateInput.addEventListener("change", render);
}

async function initializeBankTransfer() {
  const fromSelect = document.getElementById("bankTransferFrom");
  const toSelect = document.getElementById("bankTransferTo");
  const referenceInput = document.getElementById("bankTransferReference");
  const amountInput = document.getElementById("bankTransferAmount");
  const processButton = document.getElementById("processBankTransfer");
  const status = document.getElementById("bankTransferStatus");
  const historyBody = document.getElementById("bankTransferHistory");
  if (
    !fromSelect ||
    !toSelect ||
    !referenceInput ||
    !amountInput ||
    !processButton ||
    !status ||
    !historyBody
  ) {
    return;
  }

  const formatAmount = (amount) =>
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  let bankAccounts = [];
  const setStatus = (message, state = "error") => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const renderBankOptions = () => {
    const selectedFrom = fromSelect.value;
    const selectedTo = toSelect.value;
    const populate = (select, selectedValue, excludedValue, placeholder) => {
      const availableAccounts = bankAccounts.filter(
        ({ key }) => key !== excludedValue,
      );
      select.replaceChildren(
        new Option(
          availableAccounts.length
            ? placeholder
            : "No other bank accounts available",
          "",
        ),
      );
      availableAccounts.forEach(({ key, label }) => {
        select.add(new Option(label, key));
      });
      select.value = availableAccounts.some(({ key }) => key === selectedValue)
        ? selectedValue
        : "";
      select.disabled = availableAccounts.length === 0;
    };

    populate(
      fromSelect,
      selectedFrom,
      selectedTo,
      "Select source bank account",
    );
    populate(
      toSelect,
      selectedTo,
      selectedFrom,
      "Select destination bank account",
    );
  };
  const updateBalances = async () => {
    const fromKey = fromSelect.value;
    const toKey = toSelect.value;
    const fromBalance = document.getElementById("bankTransferFromBalance");
    const toBalance = document.getElementById("bankTransferToBalance");
    if (fromBalance) fromBalance.textContent = "Loading...";
    if (toBalance) toBalance.textContent = "Loading...";

    try {
      const [receiptsSnapshot, paymentsSnapshot, transfersSnapshot] =
        await Promise.all([
          getDatabaseSnapshot("bankReceipts"),
          getDatabaseSnapshot("bankPayments"),
          getDatabaseSnapshot("bankTransfers"),
        ]);
      const receipts = Object.values(receiptsSnapshot.val() || {});
      const payments = Object.values(paymentsSnapshot.val() || {});
      const transfers = Object.values(transfersSnapshot.val() || {});
      const calculateBalance = (bankKey) => {
        if (!bankKey) return null;
        const received = receipts.reduce(
          (total, receipt) =>
            receipt.into === bankKey
              ? total + (Number(receipt.amount) || 0)
              : total,
          0,
        );
        const paid = payments.reduce(
          (total, payment) =>
            payment.from === bankKey
              ? total + (Number(payment.amount) || 0)
              : total,
          0,
        );
        const transferredIn = transfers.reduce(
          (total, transfer) =>
            transfer.to === bankKey
              ? total + (Number(transfer.amount) || 0)
              : total,
          0,
        );
        const transferredOut = transfers.reduce(
          (total, transfer) =>
            transfer.from === bankKey
              ? total + (Number(transfer.amount) || 0)
              : total,
          0,
        );
        return received + transferredIn - paid - transferredOut;
      };
      if (fromBalance) {
        const balance = calculateBalance(fromKey);
        fromBalance.textContent =
          balance === null ? "Select source account" : formatAmount(balance);
      }
      if (toBalance) {
        const balance = calculateBalance(toKey);
        toBalance.textContent =
          balance === null
            ? "Select destination account"
            : formatAmount(balance);
      }
    } catch (error) {
      console.error("Error loading bank transfer balances:", error);
      if (fromBalance) fromBalance.textContent = "Unable to load";
      if (toBalance) toBalance.textContent = "Unable to load";
      setStatus(`Unable to load bank balances: ${error.message}`);
    }
  };

  const loadReference = async () => {
    referenceInput.value = "";
    referenceInput.placeholder = "Generating reference...";
    try {
      await waitForDatabaseConnection();
      const result = await runTransaction(
        ref(database, "bankTransferSequence"),
        (current) => (Number(current) || 0) + 1,
      );
      if (!result.committed) {
        throw new Error("Could not allocate a unique transfer reference.");
      }
      referenceInput.value = `BT-${String(result.snapshot.val()).padStart(6, "0")}`;
      referenceInput.placeholder = "";
    } catch (error) {
      console.error("Error generating bank transfer reference:", error);
      referenceInput.placeholder = "Reference unavailable";
      setStatus(`Unable to generate transfer reference: ${error.message}`);
    }
  };

  const renderHistory = (records) => {
    historyBody.replaceChildren();
    const entries = Object.entries(records || {}).sort(
      ([, first], [, second]) =>
        (Number(second.timestamp) || 0) - (Number(first.timestamp) || 0),
    );
    if (!entries.length) {
      const row = historyBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 6;
      cell.textContent = "No bank transfers recorded yet.";
      return;
    }
    const bankNames = new Map(
      [...fromSelect.options, ...toSelect.options]
        .filter((option) => option.value)
        .map((option) => [option.value, option.textContent]),
    );
    entries.forEach(([, transfer]) => {
      const row = historyBody.insertRow();
      const date = transfer.date
        ? new Date(`${transfer.date}T00:00:00`).toLocaleDateString()
        : "-";
      [
        date,
        transfer.reference || "-",
        bankNames.get(transfer.from) || transfer.fromName || "-",
        bankNames.get(transfer.to) || transfer.toName || "-",
        Number.isFinite(Number(transfer.amount))
          ? formatAmount(Number(transfer.amount))
          : "-",
        transfer.memo || "-",
      ].forEach((value) => {
        row.insertCell().textContent = value;
      });
    });
  };

  try {
    const snapshot = await getDatabaseSnapshot("contacts");
    bankAccounts = Object.entries(snapshot.val() || {})
      .filter(
        ([, contact]) =>
          contact &&
          String(contact.accountCategory || "")
            .trim()
            .toLowerCase() === "new bank account" &&
          contact.fullName,
      )
      .map(([key, contact]) => ({
        key,
        label: [contact.contactNumber, contact.fullName]
          .filter(Boolean)
          .join(" - "),
      }))
      .sort((first, second) => first.label.localeCompare(second.label));
    renderBankOptions();
  } catch (error) {
    console.error("Error loading bank accounts for transfer:", error);
    fromSelect.replaceChildren(new Option("Unable to load bank accounts", ""));
    toSelect.replaceChildren(new Option("Unable to load bank accounts", ""));
    fromSelect.disabled = true;
    toSelect.disabled = true;
    setStatus(`Unable to load bank accounts: ${error.message}`);
  }

  fromSelect.addEventListener("change", () => {
    renderBankOptions();
    updateBalances();
  });
  toSelect.addEventListener("change", () => {
    renderBankOptions();
    updateBalances();
  });
  await loadReference();
  await updateBalances();

  onValue(
    ref(database, "bankTransfers"),
    (snapshot) => renderHistory(snapshot.val()),
    (error) => {
      console.error("Error loading bank transfer history:", error);
      historyBody.replaceChildren();
      const row = historyBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 6;
      cell.textContent = `Unable to load bank transfer history: ${error.message}`;
    },
  );

  processButton.addEventListener("click", async () => {
    setStatus("");
    if (!referenceInput.value) {
      setStatus("Transfer reference is not ready. Please reload the page.");
      return;
    }
    if (!fromSelect.value || !toSelect.value) {
      setStatus("Select both source and destination bank accounts.");
      return;
    }
    if (fromSelect.value === toSelect.value) {
      setStatus("Source and destination accounts must be different.");
      return;
    }
    const transferDate = document.getElementById("bankTransferDate").value;
    if (!transferDate) {
      setStatus("Select a transfer date.");
      return;
    }
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("Enter a transfer amount greater than zero.");
      return;
    }

    processButton.disabled = true;
    setStatus("Saving bank transfer...", "info");
    try {
      const [fromSnapshot, toSnapshot] = await Promise.all([
        getDatabaseSnapshot(`contacts/${fromSelect.value}`),
        getDatabaseSnapshot(`contacts/${toSelect.value}`),
      ]);
      const fromAccount = fromSnapshot.val();
      const toAccount = toSnapshot.val();
      const isBankAccount = (account) =>
        account &&
        String(account.accountCategory || "")
          .trim()
          .toLowerCase() === "new bank account";
      if (!isBankAccount(fromAccount) || !isBankAccount(toAccount)) {
        throw new Error("The selected bank account could not be found.");
      }

      const transfer = {
        from: fromSelect.value,
        fromName: fromAccount.fullName || "",
        fromCode: fromAccount.contactNumber || "",
        to: toSelect.value,
        toName: toAccount.fullName || "",
        toCode: toAccount.contactNumber || "",
        amount,
        date: transferDate,
        reference: referenceInput.value,
        memo: document.getElementById("bankTransferMemo").value.trim(),
        createdBy: localStorage.getItem("username") || "User",
        timestamp: serverTimestamp(),
      };
      await push(ref(database, "bankTransfers"), transfer);
      amountInput.value = "";
      document.getElementById("bankTransferMemo").value = "";
      setStatus(
        `Bank transfer ${transfer.reference} saved successfully.`,
        "success",
      );
      await Promise.all([loadReference(), updateBalances()]);
    } catch (error) {
      console.error("Error saving bank transfer:", error);
      setStatus(`Unable to save bank transfer: ${error.message}`);
    } finally {
      processButton.disabled = false;
    }
  });
}

async function initializeCashReceiptReference() {
  const referenceInput = document.getElementById("receiptReference");
  if (!referenceInput) return;

  const page = window.location.pathname.split("/").pop();
  const isPayment = page === "cash_payment.html";
  const isBankReceipt = page === "bank_received.html";
  const isBankPayment = page === "bank_payment.html";
  const sequencePath = isPayment
    ? "cashPaymentSequence"
    : isBankReceipt
      ? "bankReceiptSequence"
      : isBankPayment
        ? "bankPaymentSequence"
        : "cashReceiptSequence";
  const referencePrefix = isPayment
    ? "CP"
    : isBankReceipt
      ? "BR"
      : isBankPayment
        ? "BP"
        : "CR";
  referenceInput.value = "";
  const errorMessage = document.getElementById("receiptReferenceError");
  try {
    await waitForDatabaseConnection();
    const result = await runTransaction(
      ref(database, sequencePath),
      (current) => (Number(current) || 0) + 1,
    );
    if (!result.committed) {
      throw new Error(
        `Could not allocate a unique ${referencePrefix} reference.`,
      );
    }

    referenceInput.value = `${referencePrefix}-${String(result.snapshot.val()).padStart(6, "0")}`;
    referenceInput.placeholder = "";
  } catch (error) {
    console.error(`Error generating ${referencePrefix} reference:`, error);
    referenceInput.placeholder = "Reference unavailable";
    if (errorMessage) {
      errorMessage.textContent =
        "Unable to generate a reference. Please check your connection and reload.";
      errorMessage.hidden = false;
    }
  }
}

function initializeCashInHandBalance() {
  const balanceElement = document.getElementById("cashInHandBalance");
  if (!balanceElement) return;

  let receipts = {};
  let payments = {};
  let bankPayments = {};
  let bankReceipts = {};
  const updateBalance = () => {
    const received = Object.values(receipts).reduce((sum, receipt) => {
      if (receipt.into && receipt.into !== "Cash in Hand") return sum;
      const amount = Number(receipt.amount);
      return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    }, 0);
    const receivedFromBank = Object.values(bankPayments).reduce(
      (sum, payment) => {
        if (payment.to !== "Cash in Hand" && payment.toCashInHand !== true) {
          return sum;
        }
        const amount = Number(payment.amount);
        return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
      },
      0,
    );
    const paid = Object.values(payments).reduce((sum, payment) => {
      if (payment.from && payment.from !== "Cash in Hand") return sum;
      const amount = Number(payment.amount);
      return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    }, 0);
    const depositedToBanks = Object.values(bankReceipts).reduce(
      (sum, receipt) => {
        if (
          receipt.fromCashInHand !== true &&
          receipt.source !== "cash-in-hand"
        ) {
          return sum;
        }
        const amount = Number(receipt.amount);
        return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
      },
      0,
    );
    balanceElement.textContent = (
      received +
      receivedFromBank -
      paid -
      depositedToBanks
    ).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  onValue(
    ref(database, "cashReceipts"),
    (snapshot) => {
      receipts = snapshot.val() || {};
      updateBalance();
    },
    (error) => {
      console.error("Error loading cash receipts for balance:", error);
      balanceElement.textContent = "Unable to load";
    },
  );
  onValue(
    ref(database, "cashPayments"),
    (snapshot) => {
      payments = snapshot.val() || {};
      updateBalance();
    },
    (error) => {
      console.error("Error loading cash payments for balance:", error);
      balanceElement.textContent = "Unable to load";
    },
  );
  onValue(
    ref(database, "bankPayments"),
    (snapshot) => {
      bankPayments = snapshot.val() || {};
      updateBalance();
    },
    (error) => {
      console.error("Error loading bank payments for cash balance:", error);
      balanceElement.textContent = "Unable to load";
    },
  );
  onValue(
    ref(database, "bankReceipts"),
    (snapshot) => {
      bankReceipts = snapshot.val() || {};
      updateBalance();
    },
    (error) => {
      console.error("Error loading bank receipts for cash balance:", error);
      balanceElement.textContent = "Unable to load";
    },
  );
}

function initializeTodayCashDeposits() {
  const tableBody = document.getElementById("todayCashDeposits");
  if (!tableBody) return;

  const page = window.location.pathname.split("/").pop();
  const isPayment = page === "cash_payment.html";
  const isBankReceipt = page === "bank_received.html";
  const isBankPayment = page === "bank_payment.html";
  const collectionName = isPayment
    ? "cashPayments"
    : isBankReceipt
      ? "bankReceipts"
      : isBankPayment
        ? "bankPayments"
        : "cashReceipts";
  const transactionName = isPayment
    ? "payments"
    : isBankPayment
      ? "payments"
      : "receipts";
  const getLocalDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = getLocalDateKey(new Date());
  const formatAmount = (amount) =>
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const openCustomerLedger = (contactKey) => {
    const ledgerUrl = new URL("customers_ledger.html", window.location.href);
    ledgerUrl.searchParams.set("contactKey", contactKey);
    window.location.href = ledgerUrl.href;
  };

  onValue(
    ref(database, collectionName),
    (snapshot) => {
      const receipts = Object.entries(snapshot.val() || {})
        .filter(([, receipt]) => {
          if (receipt.date) return receipt.date === today;
          const timestamp = Number(receipt.timestamp);
          return (
            Number.isFinite(timestamp) &&
            getLocalDateKey(new Date(timestamp)) === today
          );
        })
        .sort(([, first], [, second]) => {
          const firstTime =
            Number(first.timestamp) || Date.parse(first.date) || 0;
          const secondTime =
            Number(second.timestamp) || Date.parse(second.date) || 0;
          return secondTime - firstTime;
        });

      tableBody.replaceChildren();
      if (receipts.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = `No ${isBankReceipt || isBankPayment ? "bank" : "cash"} ${transactionName} recorded today.`;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
      }

      receipts.forEach(([key, receipt]) => {
        const row = document.createElement("tr");
        const contactKey = String(receipt.customerContactKey || "");
        if (contactKey) {
          row.dataset.contactKey = contactKey;
          row.tabIndex = 0;
          row.setAttribute("role", "link");
          row.setAttribute(
            "aria-label",
            `Open ledger for ${receipt.customerName || "customer"}, ${isPayment || isBankPayment ? "payment" : isBankReceipt ? "bank receipt" : "receipt"} ${receipt.reference || ""}`,
          );
          row.addEventListener("click", () => openCustomerLedger(contactKey));
          row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openCustomerLedger(contactKey);
            }
          });
        }

        const amount = Number(receipt.amount);
        const date = receipt.date
          ? new Date(`${receipt.date}T00:00:00`).toLocaleDateString()
          : "-";
        if (isBankReceipt || isBankPayment) {
          const transNumber =
            receipt.reference?.split("-").pop() || key.slice(-6);
          const itemReference = receipt.chequeNumber || "-";
          [
            date,
            transNumber,
            itemReference,
            Number.isFinite(amount) ? formatAmount(amount) : "-",
          ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
          });
          const printCell = document.createElement("td");
          const printButton = document.createElement("button");
          printButton.type = "button";
          printButton.className = "cash-action-button";
          printButton.textContent = "Print";
          printButton.addEventListener("click", (event) => {
            event.stopPropagation();
            printBankReceiptVoucher(receipt, isBankPayment);
          });
          printCell.appendChild(printButton);
          row.appendChild(printCell);
          tableBody.appendChild(row);
          return;
        }

        [
          date,
          receipt.reference || "-",
          receipt.memo || "-",
          Number.isFinite(amount) ? formatAmount(amount) : "-",
          receipt.customerName || receipt.customerCode || "-",
        ].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        });
        tableBody.appendChild(row);
      });
    },
    (error) => {
      console.error(
        `Error loading today's ${isBankReceipt || isBankPayment ? "bank" : "cash"} ${transactionName}:`,
        error,
      );
      tableBody.replaceChildren();
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = `Unable to load today's ${isBankReceipt || isBankPayment ? "bank" : "cash"} ${transactionName}.`;
      row.appendChild(cell);
      tableBody.appendChild(row);
    },
  );
}

function initializeBankReceiptItems() {
  const isPayment = window.location.pathname.endsWith("bank_payment.html");
  const tableBody = document.getElementById(
    isPayment ? "bankPaymentItems" : "bankReceiptItems",
  );
  const totalInput = document.getElementById(
    isPayment ? "bankPaymentSettledAmount" : "bankReceiptSettledAmount",
  );
  if (!tableBody || !totalInput) return;

  const updateTotal = () => {
    const amount = Number(
      tableBody.rows[0]?.querySelector(
        `[aria-label="${isPayment ? "Payment" : "Deposit"} amount"]`,
      )?.value,
    );
    totalInput.value =
      Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "0.00";
  };

  tableBody.addEventListener("input", (event) => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.getAttribute("aria-label") ===
        `${isPayment ? "Payment" : "Deposit"} amount`
    ) {
      updateTotal();
    }
  });
  updateTotal();
}

function printBankReceiptVoucher(receipt, isPayment = false) {
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) {
    alert("Please allow pop-ups to print this bank receipt.");
    return;
  }

  const printDocument = printWindow.document;
  printDocument.title = `Bank ${isPayment ? "Payment" : "Receipt"} ${receipt.reference || ""}`;
  const heading = printDocument.createElement("h1");
  heading.textContent = `Bank Account ${isPayment ? "Payment" : "Deposit"} Entry`;
  printDocument.body.appendChild(heading);
  [
    ["Date", receipt.date || "-"],
    ["Reference", receipt.reference || "-"],
    ["Cheque", receipt.chequeNumber || "-"],
    ["Cheque Date", receipt.chequeDate || "-"],
    ["Customer", receipt.customerName || "-"],
    ["Bank Account", receipt.bankAccountName || "-"],
    ["Amount", Number(receipt.amount || 0).toFixed(2)],
    ["Memo", receipt.memo || "-"],
  ].forEach(([label, value]) => {
    const line = printDocument.createElement("p");
    const strong = printDocument.createElement("strong");
    strong.textContent = `${label}: `;
    line.append(strong, printDocument.createTextNode(value));
    printDocument.body.appendChild(line);
  });
  const style = printDocument.createElement("style");
  style.textContent =
    "body{font:14px Arial,sans-serif;margin:32px;color:#26394a}h1{font-size:20px;border-bottom:1px solid #999;padding-bottom:10px}";
  printDocument.head.appendChild(style);
  printWindow.focus();
  printWindow.print();
}

function initializeBankReceiptProcessing(isPayment = false) {
  const processButton = document.getElementById("processCashReceipt");
  const status = document.getElementById("cashReceiptSaveStatus");
  const tableBody = document.getElementById(
    isPayment ? "bankPaymentItems" : "bankReceiptItems",
  );
  const sourceSelect = document.getElementById("receiptFrom");
  const customerSelect = document.getElementById("receiptCustomer");
  const bankSelect = document.getElementById("receiptInto");
  const referenceInput = document.getElementById("receiptReference");
  const totalInput = document.getElementById(
    isPayment ? "bankPaymentSettledAmount" : "bankReceiptSettledAmount",
  );
  const bankPaymentLabel = isPayment ? "bank payment" : "bank receipt";
  if (
    !processButton ||
    !status ||
    !tableBody ||
    !sourceSelect ||
    !customerSelect ||
    !bankSelect ||
    !referenceInput ||
    !totalInput
  ) {
    return;
  }

  const setStatus = (message, state = "error") => {
    status.textContent = message;
    status.dataset.state = state;
  };

  processButton.addEventListener("click", async () => {
    setStatus("");
    const isCashInHandReceipt =
      !isPayment && sourceSelect.value === "cash-in-hand";
    if (!isCashInHandReceipt && !customerSelect.value) {
      setStatus(
        `Select a customer before processing this ${bankPaymentLabel}.`,
      );
      return;
    }
    if (!referenceInput.value) {
      setStatus(
        `The ${bankPaymentLabel} reference is not ready. Please wait or reload the page.`,
      );
      return;
    }
    if (!bankSelect.value) {
      setStatus(
        `Select a bank account before processing this ${bankPaymentLabel}.`,
      );
      return;
    }

    const row = tableBody.rows[0];
    const depositAmount = Number(
      row?.querySelector(
        `[aria-label="${isPayment ? "Payment" : "Deposit"} amount"]`,
      )?.value,
    );
    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      setStatus(
        `${isPayment ? "Payment" : "Deposit"} amount must be a valid number greater than or equal to zero.`,
      );
      return;
    }
    const amount = depositAmount;
    if (amount <= 0) {
      setStatus(
        `Enter a ${isPayment ? "payment" : "deposit"} amount before processing.`,
      );
      return;
    }

    processButton.disabled = true;
    setStatus(`Saving ${bankPaymentLabel} to the customer ledger...`, "info");
    try {
      const [customerSnapshot, bankSnapshot, cashAccountSnapshot] =
        await Promise.all([
          isCashInHandReceipt
            ? Promise.resolve(null)
            : getDatabaseSnapshot(`contacts/${customerSelect.value}`),
          getDatabaseSnapshot(`contacts/${bankSelect.value}`),
          isCashInHandReceipt
            ? getDatabaseSnapshot("contacts")
            : Promise.resolve(null),
        ]);
      const cashAccountContact = Object.values(
        cashAccountSnapshot?.val() || {},
      ).find(
        (contact) =>
          contact &&
          String(contact.fullName || "")
            .trim()
            .toLowerCase() === "cash in hand",
      );
      const customer = isCashInHandReceipt
        ? {
            fullName: "Cash in Hand",
            contactNumber: cashAccountContact?.contactNumber || "",
          }
        : customerSnapshot.val();
      const bankAccount = bankSnapshot.val();
      if (
        !isCashInHandReceipt &&
        (!customer ||
          String(customer.accountCategory || "")
            .trim()
            .toLowerCase() !== "new customer")
      ) {
        throw new Error("The selected customer could not be found.");
      }
      if (
        !bankAccount ||
        String(bankAccount.accountCategory || "")
          .trim()
          .toLowerCase() !== "new bank account"
      ) {
        throw new Error("The selected bank account could not be found.");
      }

      const voucher = {
        ...(isCashInHandReceipt
          ? { fromCashInHand: true }
          : { customerContactKey: customerSelect.value }),
        customerCode: customer.contactNumber || "",
        customerName: customer.fullName || "",
        accountCode: customer.contactNumber || "",
        reference: referenceInput.value,
        date: document.getElementById("receiptDate").value,
        chequeNumber: document
          .getElementById(
            isPayment ? "bankPaymentChequeNumber" : "bankReceiptChequeNumber",
          )
          .value.trim(),
        chequeDate: document.getElementById(
          isPayment ? "bankPaymentChequeDate" : "bankReceiptChequeDate",
        ).value,
        source: isCashInHandReceipt ? "cash-in-hand" : "customer",
        ...(isPayment
          ? { from: bankSelect.value }
          : { into: bankSelect.value }),
        bankAccountName: bankAccount.fullName || "",
        bankAccountCode: bankAccount.contactNumber || "",
        accountCode:
          row.querySelector('[aria-label="Account code"]')?.value || "",
        amount,
        settledArAmount: amount,
        memo: document.getElementById("receiptMemo").value.trim(),
        createdBy: localStorage.getItem("username") || "User",
        timestamp: serverTimestamp(),
      };
      await push(
        ref(database, isPayment ? "bankPayments" : "bankReceipts"),
        voucher,
      );

      const amountField = row.querySelector(
        `[aria-label="${isPayment ? "Payment" : "Deposit"} amount"]`,
      );
      if (amountField) amountField.value = "0.00";
      document.getElementById(
        isPayment ? "bankPaymentChequeNumber" : "bankReceiptChequeNumber",
      ).value = "";
      document.getElementById("receiptMemo").value = "";
      totalInput.value = "0.00";
      updateBankReceiptBalance();
      if (isCashInHandReceipt) updateBankReceivedCashBalance();
      setStatus(
        isCashInHandReceipt
          ? `Bank receipt ${voucher.reference} recorded from Cash in Hand.`
          : `Bank ${isPayment ? "payment" : "receipt"} ${voucher.reference} saved to ${voucher.customerName}'s ledger.`,
        "success",
      );
      await initializeCashReceiptReference();
    } catch (error) {
      console.error(
        `Error saving ${bankPaymentLabel} to customer ledger:`,
        error,
      );
      setStatus(
        `Unable to save ${bankPaymentLabel}: ${error.message || "Please try again."}`,
      );
    } finally {
      processButton.disabled = false;
    }
  });
}

function initializeCashReceiptProcessing() {
  const processButton = document.getElementById("processCashReceipt");
  if (!processButton) return;

  const page = window.location.pathname.split("/").pop();
  const isPayment = page === "cash_payment.html";
  const isBankReceipt = page === "bank_received.html";
  const isBankPayment = page === "bank_payment.html";
  if (isBankReceipt || isBankPayment) {
    initializeBankReceiptProcessing(isBankPayment);
    return;
  }
  const voucherName = isPayment
    ? "payment"
    : isBankReceipt
      ? "bank receipt"
      : "deposit";
  const collectionName = isPayment
    ? "cashPayments"
    : isBankReceipt
      ? "bankReceipts"
      : "cashReceipts";
  const status = document.getElementById("cashReceiptSaveStatus");
  const tableBody = document.querySelector(
    '[aria-labelledby="depositItemsHeading"] .cash-table tbody',
  );
  const denominations = [5000, 1000, 500, 100, 50, 20, 10];
  const setStatus = (message, state = "error") => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  };

  processButton.addEventListener("click", async () => {
    const sourceSelect = document.getElementById("receiptFrom");
    const customerSelect = document.getElementById("receiptCustomer");
    const selectedCustomer = customerSelect?.selectedOptions[0];
    const referenceInput = document.getElementById("receiptReference");
    const bankAccountKey = isBankReceipt
      ? document.getElementById("receiptInto")?.value
      : "";
    const row = tableBody?.rows[0];
    if (!status || !row || !sourceSelect || !referenceInput) return;

    setStatus("");
    if (sourceSelect.value !== "customer" || !customerSelect?.value) {
      setStatus(`Select a customer before processing this ${voucherName}.`);
      return;
    }
    if (!referenceInput.value) {
      setStatus(
        `The ${voucherName} reference is not ready. Please wait or reload the page.`,
      );
      return;
    }
    if (isBankReceipt && !bankAccountKey) {
      setStatus("Select a bank account before processing this bank receipt.");
      return;
    }

    const noteInputs = [
      ...row.querySelectorAll('input[type="number"][aria-label$="notes"]'),
    ];
    const rawCounts = noteInputs.map((input) => input.value.trim());
    const invalidCount = rawCounts.some((value) => {
      if (!value) return false;
      const count = Number(value);
      return !Number.isInteger(count) || count < 0;
    });
    if (invalidCount) {
      setStatus(
        "Note quantities must be whole numbers greater than or equal to zero.",
      );
      return;
    }
    const counts = rawCounts.map((value) => Number(value) || 0);
    const amount = counts.reduce(
      (total, count, index) => total + count * denominations[index],
      0,
    );
    if (amount <= 0) {
      setStatus("Enter at least one note amount before processing.");
      return;
    }

    processButton.disabled = true;
    setStatus(`Saving ${voucherName} to the customer ledger...`, "info");
    try {
      const customerSnapshot = await getDatabaseSnapshot(
        `contacts/${customerSelect.value}`,
      );
      const customer = customerSnapshot.val();
      if (!customer) {
        throw new Error("The selected customer could not be found.");
      }

      let bankAccount = null;
      if (isBankReceipt) {
        const bankSnapshot = await getDatabaseSnapshot(
          `contacts/${bankAccountKey}`,
        );
        bankAccount = bankSnapshot.val();
        if (
          !bankAccount ||
          String(bankAccount.accountCategory || "")
            .trim()
            .toLowerCase() !== "new bank account"
        ) {
          throw new Error("The selected bank account could not be found.");
        }
      }

      const voucher = {
        customerContactKey: customerSelect.value,
        customerCode: customer.contactNumber || "",
        customerName: customer.fullName || selectedCustomer.textContent || "",
        accountCode:
          row.querySelector('[aria-label="Account code"]')?.value || "",
        reference: referenceInput.value,
        date: document.getElementById("receiptDate")?.value || "",
        source: "customer",
        ...(isPayment
          ? {
              from:
                document.getElementById("receiptInto")?.value || "Cash in Hand",
            }
          : isBankReceipt
            ? {
                into: bankAccountKey,
                bankAccountName: bankAccount.fullName || "",
                bankAccountCode: bankAccount.contactNumber || "",
              }
            : {
                into:
                  document.getElementById("receiptInto")?.value ||
                  "Cash in Hand",
              }),
        denominations: Object.fromEntries(
          denominations.map((denomination, index) => [
            String(denomination),
            counts[index],
          ]),
        ),
        amount,
        memo: document.getElementById("receiptMemo")?.value.trim() || "",
        createdBy: localStorage.getItem("username") || "User",
        timestamp: serverTimestamp(),
      };
      await push(ref(database, collectionName), voucher);

      noteInputs.forEach((input) => {
        input.value = "0";
      });
      const totalInput = row.querySelector('[aria-label="Total amount"]');
      if (totalInput) totalInput.value = "0.00";
      const memoInput = document.getElementById("receiptMemo");
      if (memoInput) memoInput.value = "";
      setStatus(
        `${isPayment ? "Payment" : isBankReceipt ? "Bank receipt" : "Deposit"} ${voucher.reference} saved to ${voucher.customerName}'s ledger.`,
        "success",
      );
      await initializeCashReceiptReference();
    } catch (error) {
      console.error(`Error saving ${voucherName} to customer ledger:`, error);
      setStatus(
        `Unable to save ${voucherName}: ${error.message || "Please try again."}`,
      );
    } finally {
      processButton.disabled = false;
    }
  });
}

function initializeCashReceiptItems() {
  const tableBody = document.querySelector(
    '[aria-labelledby="depositItemsHeading"] .cash-table tbody',
  );
  if (!tableBody) return;

  const denominations = [5000, 1000, 500, 100, 50, 20, 10];
  const updateRowTotal = (row) => {
    const counts = row.querySelectorAll(
      'input[type="number"][aria-label$="notes"]',
    );
    const total = [...counts].reduce((sum, input, index) => {
      const count = Number(input.value);
      return (
        sum +
        (Number.isFinite(count) && count > 0 ? count : 0) * denominations[index]
      );
    }, 0);
    const totalInput = row.querySelector('[aria-label="Total amount"]');
    if (totalInput) totalInput.value = total.toFixed(2);
  };

  tableBody.addEventListener("input", (event) => {
    const input = event.target;
    if (
      input instanceof HTMLInputElement &&
      input.type === "number" &&
      input.getAttribute("aria-label")?.endsWith("notes")
    ) {
      updateRowTotal(input.closest("tr"));
    }
  });
}

window.openWindow = function (url, target) {
  const popup = window.open(
    url,
    target || "_blank",
    "width=760,height=620,resizable=yes,scrollbars=yes",
  );
  if (!popup) {
    alert("Please allow pop-ups for this site to open query follow-ups.");
    return null;
  }
  popup.focus();
  return popup;
};

function ensureNotificationMenu() {
  const page = window.location.pathname.split("/").pop();
  if (page === "index.html" || page === "" || page === "query_follow_up.html")
    return;

  if (!document.querySelector('link[href="notification.css"]')) {
    const notificationStyles = document.createElement("link");
    notificationStyles.rel = "stylesheet";
    notificationStyles.href = "notification.css";
    document.head.appendChild(notificationStyles);
  }

  if (
    ![...document.querySelectorAll('link[rel="stylesheet"]')].some((link) =>
      link.href.includes("font-awesome"),
    )
  ) {
    const iconStyles = document.createElement("link");
    iconStyles.rel = "stylesheet";
    iconStyles.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css";
    document.head.appendChild(iconStyles);
  }

  if (document.querySelector(".notification-menu")) return;

  const menu = document.createElement("details");
  menu.className = "notification-menu";

  const trigger = document.createElement("summary");
  trigger.setAttribute("aria-label", "Notifications");
  trigger.title = "Notifications";
  const icon = document.createElement("i");
  icon.className = "fas fa-bell";
  icon.setAttribute("aria-hidden", "true");
  const count = document.createElement("span");
  count.className = "notification-count";
  count.hidden = true;
  trigger.append(icon, count);

  const popup = document.createElement("div");
  popup.className = "notification-popup";
  popup.setAttribute("role", "status");
  const heading = document.createElement("strong");
  heading.textContent = "Notifications";
  const emptyMessage = document.createElement("p");
  emptyMessage.textContent = "No new notifications";
  popup.append(heading, emptyMessage);
  menu.append(trigger, popup);

  const toolbar = document.querySelector(
    ".nav-right, .nav-right-meta, .user-info",
  );
  const header = document.querySelector(".top-nav, .navbar, .company-header");
  (toolbar || header || document.body).appendChild(menu);
}

function highlightCurrentSidebarPage() {
  const page = window.location.pathname.split("/").pop();
  const pageAliases = {
    "add_new_contect.html": "Contact_Book_Inquiry.html",
    "add_new_query.html": "query_inquiry.html",
    "add_temp_booking.html": "temporary_booking.html",
  };
  const currentPage = pageAliases[page] || page;
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  sidebar.querySelectorAll(".menu-head").forEach((heading) => {
    heading.classList.remove("active");
  });
  sidebar.querySelectorAll(".menu-content").forEach((menu) => {
    menu.classList.remove("show");
  });

  const currentLink = [...sidebar.querySelectorAll("a[href]")].find(
    (link) =>
      new URL(link.href, window.location.href).pathname.split("/").pop() ===
      currentPage,
  );
  const currentButton = currentLink?.querySelector(".sub-link");
  const currentMenu = currentLink?.closest(".menu-content");
  if (!currentButton || !currentMenu) return;

  currentButton.classList.add("active-page");
  currentMenu.classList.add("show");
  currentMenu
    .closest(".menu-group")
    ?.querySelector(".menu-head")
    ?.classList.add("active");
}

function initializeLastPaymentEntry() {
  const description = document.getElementById("lastEntryDescription");
  const dateTime = document.getElementById("lastEntryDateTime");
  if (!description || !dateTime) return;

  const collections = {
    cashReceipts: "cash receipt",
    cashPayments: "cash payment",
    bankReceipts: "bank receipt",
    bankPayments: "bank payment",
  };
  const recordsByCollection = new Map();
  const renderLatestEntry = () => {
    const entries = [...recordsByCollection.entries()].flatMap(
      ([collectionName, records]) =>
        Object.entries(records || {}).map(([key, record]) => {
          const timestamp = Number(record?.timestamp);
          const date = record?.date ? Date.parse(record.date) : Number.NaN;
          return {
            collectionName,
            record,
            key,
            time:
              Number.isFinite(timestamp) && timestamp > 0
                ? timestamp
                : Number.isFinite(date)
                  ? date
                  : 0,
          };
        }),
    );
    const latest = entries
      .filter((entry) => entry.time > 0)
      .sort((first, second) => second.time - first.time)[0];

    if (!latest) {
      description.textContent = entries.length
        ? "No entry date/time is available."
        : "No payment entries yet.";
      dateTime.textContent = "";
      dateTime.removeAttribute("datetime");
      return;
    }

    const { collectionName, record, time } = latest;
    const isPayment =
      collectionName === "cashPayments" || collectionName === "bankPayments";
    const isBank =
      collectionName === "bankReceipts" || collectionName === "bankPayments";
    const fromCashInHand =
      record.fromCashInHand === true ||
      String(record.source || "")
        .trim()
        .toLowerCase() === "cash-in-hand";
    const entryAction = fromCashInHand
      ? "CASH IN HAND DEPOSITED TO BANK"
      : isPayment
        ? "CLIENT RECEIVED PAYMENT FROM"
        : "CLIENT GAVE PAYMENT TO";
    const customerName =
      record.customerName || record.customer || "Customer name unavailable";
    const bankName =
      record.bankAccountName ||
      record.fromName ||
      record.intoName ||
      (isBank ? record.from || record.into : "");
    const accountName = isBank
      ? `BANK: ${bankName || "Bank account"}`
      : "CASH IN HAND";
    const entryUser = record.createdBy || "Unknown user";
    const entryMessage = fromCashInHand
      ? `${customerName} | ${entryAction} | ${accountName}`
      : `${entryUser} ADD NEW ENTRY (${customerName}) | ${entryAction} ${accountName}`;
    description.textContent = `${record.reference ? `${record.reference} | ` : ""}${entryMessage}`;
    const savedAt = new Date(time);
    dateTime.dateTime = savedAt.toISOString();
    dateTime.textContent = savedAt.toLocaleString();
  };

  Object.keys(collections).forEach((collectionName) => {
    onValue(
      ref(database, collectionName),
      (snapshot) => {
        recordsByCollection.set(collectionName, snapshot.val() || {});
        renderLatestEntry();
      },
      (error) => {
        console.error(
          `Unable to load ${collections[collectionName]} history:`,
          error,
        );
        description.textContent = `Unable to load latest payment: ${error.message}`;
      },
    );
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (
    window.location.pathname.split("/").pop() !== "index.html" &&
    !window.hasAuthenticatedSession?.()
  ) {
    window.location.replace("index.html");
    return;
  }

  const queryCreatorId = document.getElementById("q_assign_by");
  if (queryCreatorId) {
    queryCreatorId.textContent = localStorage.getItem("username") || "-";
  }

  ensureNotificationMenu();
  highlightCurrentSidebarPage();
  const pageName = window.location.pathname.split("/").pop();
  if (pageName === "ticket.html") {
    initializeLastPaymentEntry();
  }
  if (pageName === "day_book.html") {
    initializeDayBookSummary().catch((error) => {
      console.error("Unable to load Day Book data:", error);
      const status = document.getElementById("dayBookStatus");
      if (status) {
        status.textContent = `Unable to load Day Book data: ${error.message || "Please try again."}`;
        status.hidden = false;
      }
      [
        "dayBookCashOpening",
        "dayBookCashBalance",
        "dayBookBankBalance",
        "dayBookTotalBalance",
        "dayBookProfitToday",
        "dayBookExpenseToday",
        "dayBookMonthProfit",
        "dayBookMonthExpense",
        "dayBookMonthNet",
      ].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.textContent = "Unable to load";
      });
    });
  }
  if (pageName === "bank_transfer.html") {
    initializeBankTransfer();
  }
  const needsVendorMigration = [
    "Contact_Book_Inquiry.html",
    "customers.html",
    "add_new_contect.html",
    "cash_received.html",
    "cash_payment.html",
    "bank_received.html",
    "bank_payment.html",
    "ticket_booking.html",
  ].includes(pageName);
  let vendorMigrationSucceeded = true;
  if (needsVendorMigration) {
    try {
      await migrateLegacyVendorsToContacts();
    } catch (error) {
      vendorMigrationSucceeded = false;
      console.error(
        "Unable to import saved vendors into the Contact Book:",
        error,
      );
      const message = `Unable to import saved vendors into the Contact Book: ${error.message}`;
      const status = document.getElementById("vendorMigrationStatus");
      if (status) {
        status.textContent = message;
        status.hidden = false;
      }
      const contactList = document.getElementById("serverData");
      if (contactList) {
        contactList.innerHTML = `<tr><td colspan="13">${message}</td></tr>`;
      }
      const supplierSelect = document.getElementById("supplier_select");
      if (supplierSelect) {
        supplierSelect.replaceChildren(new Option(message, ""));
        supplierSelect.disabled = true;
      }
      const receiptSupplier = document.getElementById("receiptSupplier");
      if (receiptSupplier) {
        receiptSupplier.replaceChildren(new Option(message, ""));
        receiptSupplier.disabled = true;
      }
    }
  }
  loadCustomerReportContacts();
  loadCustomerLedgerPage();
  loadCustomerLedgerReportPage();
  loadCashReceiptSourceOptions();
  initializeBankReceiptAccounts();
  initializeBankReceiptItems();
  initializeCashReceiptReference();
  initializeCashInHandBalance();
  initializeTodayCashDeposits();
  initializeCashReceiptProcessing();
  initializeCashReceiptItems();
  document.querySelectorAll(".account-category-button").forEach((button) => {
    button.addEventListener("click", () => {
      const categoryInput = document.getElementById("add_account_category");
      if (!categoryInput) return;

      categoryInput.value = button.dataset.accountCategory || "";
      document
        .querySelectorAll(".account-category-button")
        .forEach((categoryButton) => {
          categoryButton.classList.toggle(
            "selected",
            categoryButton === button,
          );
        });
    });
  });
  const requestedAccountCategory = new URLSearchParams(
    window.location.search,
  ).get("category");
  if (requestedAccountCategory) {
    document
      .querySelector(
        `.account-category-button[data-account-category="${CSS.escape(requestedAccountCategory)}"]`,
      )
      ?.click();
  }
  if (pageName === "Contact_Book_Inquiry.html" && vendorMigrationSucceeded) {
    window.handleSearch();
  }
  loadQueryContactDropdown();
  loadQueryForwardedUsers();
  loadUserNotifications();

  updateClock();
  setInterval(updateClock, 1000);

  // Foran permissions apply karein[cite: 5]
  window.applyRoleBasedAccess();
});

window.logoutUser = function () {
  signOut(auth)
    .catch((error) => {
      console.error("Firebase sign-out failed:", error);
      alert("Unable to securely sign out. Please try again.");
    })
    .finally(() => {
      [
        "username",
        "role",
        "companyid",
        "uid",
        "authUid",
        "authLastActivityAt",
        "authenticatedSession",
      ].forEach((key) => localStorage.removeItem(key));
      sessionStorage.removeItem("postLoginRedirect");
      window.location.replace("index.html");
    });
};

// ==========================================
// 2. CORE UI & DASHBOARD LOGIC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  updateClock();
  setInterval(updateClock, 1000);
  applyRoleBasedAccess();

  // Sidebar link logic
  const userAccountsItem = document.getElementById("userAccountsItem");
  if (userAccountsItem) {
    userAccountsItem.addEventListener("click", () => {
      window.location.href = "user_accounts.html";
    });
  }
});

function updateClock() {
  const clockElement = document.getElementById("clock");
  if (clockElement) {
    const now = new Date();
    clockElement.innerText = `${now.toLocaleDateString("en-GB")} | ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }
}

function switchService(serviceName) {
  const sidebars = ["ticketSidebar", "visaSidebar", "accountsSidebar"];
  sidebars.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const targetId =
    serviceName === "visa"
      ? "visaSidebar"
      : serviceName === "accounts"
        ? "accountsSidebar"
        : "ticketSidebar";
  const target = document.getElementById(targetId);
  if (target) target.style.display = "block";
}

window.toggleMenu = function (menuId) {
  // Pehle baqi sab menus se 'show' class hatao
  document.querySelectorAll(".menu-content").forEach((m) => {
    if (m.id !== menuId) {
      m.classList.remove("show");
    }
  });

  // Target menu ko toggle karo
  const target = document.getElementById(menuId);
  if (target) {
    target.classList.toggle("show");
  }
};

// ==========================================
// 3. AUTHENTICATION & SECURITY (UPDATED)
window.handleLogin = function (event) {
  event.preventDefault();
  const loader = document.getElementById("loadingOverlay");
  if (loader) loader.style.display = "flex";
  const loginName = document.getElementById("login_user").value.trim().toLowerCase();
  const password = document.getElementById("login_pass").value;
  const companyid = document.getElementById("login_company").value.trim();

  get(ref(database, "users"))
    .then((snapshot) => {
      const users = snapshot.val() || {};
      for (const role of ["admins", "workers"]) {
        const accounts = users[role] || {};
        for (const [userId, account] of Object.entries(accounts)) {
          if (
            account &&
              account.username?.trim().toLowerCase() === loginName &&
            account.password === password &&
            String(account.companyid || "").trim() === companyid
          ) {
            localStorage.setItem("role", role);
            const signedInUsername = account.username || loginName;
            localStorage.setItem("username", signedInUsername);
            localStorage.setItem("companyid", companyid);
            localStorage.setItem("uid", userId);
            localStorage.removeItem("authUid");
            localStorage.setItem("authLastActivityAt", String(Date.now()));
            localStorage.setItem(
              "authenticatedSession",
              JSON.stringify({
                role,
                username: signedInUsername,
                companyid,
                uid: userId,
              }),
            );
            const requestedPage = sessionStorage.getItem("postLoginRedirect");
            sessionStorage.removeItem("postLoginRedirect");
            const destination = requestedPage
              ? new URL(requestedPage, window.location.href)
              : new URL("ticket.html", window.location.href);
            if (
              destination.origin !== window.location.origin ||
              destination.pathname.endsWith("/index.html")
            ) {
              throw new Error("Invalid post-login destination.");
            }
            window.location.replace(destination.href);
            return;
          }
        }
      }
      throw new Error("Invalid username, password, or company ID.");
    })
    .catch((error) => {
      [
        "username",
        "role",
        "companyid",
        "uid",
        "authUid",
        "authLastActivityAt",
        "authenticatedSession",
      ].forEach((key) => localStorage.removeItem(key));
      if (loader) loader.style.display = "none";
      console.error("Legacy login failed:", error);
      alert(error.message || "Unable to sign in. Please try again.");
    });
};

window.applyRoleBasedAccess = function () {
  // Trim kiya taake space ka masla na ho
  const userRole = (localStorage.getItem("role") || "").trim().toLowerCase();

  const adminItems = [
    "userAccountsItem",
    "changePasswordItem",
    "allProfilesBtn",
    "miscSettingsItem",
    "chartOfAccountsItem",
    "userDeleteItem",
  ];

  adminItems.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      // Sirf 'admins' ko dikhao, baqi sab ke liye hidden
      if (userRole === "admins") {
        el.style.display = "flex";
      } else {
        el.style.setProperty("display", "none", "important");
      }
    }
  });
};

// ==========================================
// 4. CONTACT BOOK SYSTEM
// ==========================================
// ==========================================
// 4. CONTACT BOOK SYSTEM - FIXED SAVE FUNCTION
// ==========================================
function contactSequenceValue(value) {
  const match = String(value || "").match(/(\d+)$/);
  return Number(match?.[1] || 0);
}

async function migrateLegacyVendorsToContacts() {
  const [vendorsSnapshot, contactsSnapshot] = await Promise.all([
    getDatabaseSnapshot("vendors"),
    getDatabaseSnapshot("contacts"),
  ]);
  const vendors = vendorsSnapshot.val() || {};
  const contacts = contactsSnapshot.val() || {};
  let importedCount = 0;

  for (const [vendorKey, vendor] of Object.entries(vendors)) {
    if (!vendor || !vendor.name) continue;

    const legacyContactKey = `legacy-vendor-${vendorKey}`;
    if (contacts[legacyContactKey]) continue;

    const normalizedName = String(vendor.name).trim().toLowerCase();
    const normalizedPhone = String(vendor.contact || "").trim();
    const existingContact = Object.entries(contacts).find(([, contact]) => {
      return (
        contact &&
        String(contact.accountCategory || "")
          .trim()
          .toLowerCase() === "new vendor" &&
        String(contact.fullName || "")
          .trim()
          .toLowerCase() === normalizedName &&
        String(contact.contactNo || "").trim() === normalizedPhone
      );
    });

    if (existingContact) {
      await update(ref(database, `contacts/${existingContact[0]}`), {
        legacyVendorKey: vendorKey,
        address: existingContact[1].address || vendor.address || "",
      });
      contacts[existingContact[0]] = {
        ...existingContact[1],
        legacyVendorKey: vendorKey,
        address: existingContact[1].address || vendor.address || "",
      };
      continue;
    }

    const contactNumber = await allocateContactNumber(contacts);
    const contact = {
      fullName: vendor.name,
      accountCategory: "New Vendor",
      contactNumber,
      contactNo: vendor.contact || "",
      email: vendor.email || "",
      address: vendor.address || "",
      addedBy: vendor.addedBy || localStorage.getItem("username") || "-",
      timestamp: vendor.timestamp || serverTimestamp(),
      legacyVendorKey: vendorKey,
    };
    await set(ref(database, `contacts/${legacyContactKey}`), contact);
    contacts[legacyContactKey] = contact;
    importedCount += 1;
  }

  return importedCount;
}

async function allocateContactNumber(existingContacts) {
  let contacts = existingContacts;
  if (!contacts) {
    const snapshot = await get(ref(database, "contacts"));
    contacts = snapshot.val() || {};
  }

  const highestAssignedNumber = Object.values(contacts).reduce(
    (highest, contact) =>
      Math.max(highest, contactSequenceValue(contact.contactNumber)),
    0,
  );
  await runTransaction(ref(database, "contactSequence"), (current) =>
    Math.max(Number(current) || 0, highestAssignedNumber),
  );

  const result = await runTransaction(
    ref(database, "contactSequence"),
    (current) => (Number(current) || 0) + 1,
  );
  if (!result.committed) {
    throw new Error("Could not allocate a unique contact number.");
  }

  return `CT-${String(result.snapshot.val()).padStart(6, "0")}`;
}

window.saveToFirebase = function () {
  // 1. Sare Input Elements ko fetch karein
  const nameElem = document.getElementById("add_name");
  const clientTypeElem = document.getElementById("add_client_type");
  const documentTypeElem = document.getElementById("add_document_type");
  const documentNoElem = document.getElementById("add_document_no");
  const documentIssueDateElem = document.getElementById(
    "add_document_issue_date",
  );
  const documentExpiryElem = document.getElementById("add_document_expiry");
  const phoneElem = document.getElementById("add_phone");
  const countryElem = document.getElementById("countrySelect");
  const cityElem = document.getElementById("citySelect");
  const whatsappElem = document.getElementById("add_whatsapp");
  const emailElem = document.getElementById("add_email");
  const companyElem = document.getElementById("add_company");
  const addressElem = document.getElementById("add_address");
  const positionElem = document.getElementById("add_position");
  const accountCategoryElem = document.getElementById("add_account_category");

  // 2. Mandatory elements ki safety check
  if (!nameElem || !phoneElem) {
    console.error(
      "Critical Error: HTML input IDs (add_name or add_phone) are missing!",
    );
    alert("System Error: Form inputs not found.");
    return;
  }

  // 3. Values extract karein aur trim karein (extra spaces khatam karne ke liye)
  const name = nameElem.value.trim();
  const clientType = clientTypeElem ? clientTypeElem.value : "Passenger";
  const documentType = documentTypeElem ? documentTypeElem.value : "";
  const documentNo = documentNoElem ? documentNoElem.value.trim() : "";
  const documentIssueDate = documentIssueDateElem
    ? documentIssueDateElem.value
    : "";
  const documentExpiry = documentExpiryElem ? documentExpiryElem.value : "";
  const phone = phoneElem.value.trim();
  const country = countryElem ? countryElem.value : "";
  const city = cityElem ? cityElem.value : "";
  const whatsapp = whatsappElem ? whatsappElem.value.trim() : "";
  const email = emailElem ? emailElem.value.trim() : "";
  const company = companyElem ? companyElem.value.trim() : "";
  const address = addressElem ? addressElem.value.trim() : "";
  const position = positionElem ? positionElem.value : "";
  const accountCategory = accountCategoryElem ? accountCategoryElem.value : "";

  // 4. A name and account list are required; phone numbers are optional.
  if (!name) {
    alert("Error: Full Name is required!");
    return;
  }
  if (!window.editingContactKey && !accountCategory) {
    alert("Please select an account list before saving this contact.");
    return;
  }

  // 5. Firebase Reference banayein[cite: 3]
  // 'database' variable wahi hai jo aapne script ke shuru mein initialize kiya hai[cite: 3]
  const contactsRef = ref(database, "contacts");

  // 6. Modular 'push' use karein (v9 syntax)[cite: 3]
  const contactData = {
    fullName: name,
    accountCategory,
    clientType,
    documentType,
    documentNo,
    documentIssueDate,
    documentExpiry,
    passportNo: documentType === "Passport" ? documentNo : "",
    passportExpiry: documentType === "Passport" ? documentExpiry : "",
    contactNo: phone,
    whatsappNo: whatsapp,
    email: email,
    companyName: company,
    address,
    position: position,
    country: country,
    city: city,
    addedBy: localStorage.getItem("username"),
    timestamp: serverTimestamp(), // Yeh server ka waqt record karega[cite: 3]
  };

  const saveRequest = (async () => {
    contactData.contactNumber =
      window.editingContactNumber || (await allocateContactNumber());

    if (window.editingContactKey) {
      return update(
        ref(database, `contacts/${window.editingContactKey}`),
        contactData,
      );
    }

    return set(push(contactsRef), contactData);
  })();

  saveRequest
    .then(() => {
      alert(
        window.editingContactKey
          ? "Contact updated successfully!"
          : "Success: Contact saved to server!",
      );
      // Data save hone ke baad list wale page par wapis jayein[cite: 3]
      window.location.href = "Contact_Book_Inquiry.html";
    })
    .catch((err) => {
      console.error("Firebase Push Error:", err);
      alert("Error saving contact: " + err.message);
    });
};

window.editContact = function (contactKey) {
  get(ref(database, `contacts/${contactKey}`))
    .then((snapshot) => {
      const contact = snapshot.val();
      if (!contact) {
        alert("Contact record not found.");
        return;
      }

      window.editingContactKey = contactKey;
      window.editingContactNumber = contact.contactNumber || "";
      document.getElementById("add_name").value = contact.fullName || "";
      document.getElementById("add_client_type").value =
        contact.clientType || "Passenger";
      document.getElementById("add_document_type").value =
        contact.documentType || (contact.passportNo ? "Passport" : "Other");
      document.getElementById("add_document_no").value =
        contact.documentNo || contact.passportNo || "";
      document.getElementById("add_document_issue_date").value =
        contact.documentIssueDate || contact.dateOfBirth || "";
      document.getElementById("add_document_expiry").value =
        contact.documentExpiry || contact.passportExpiry || "";
      document.getElementById("add_phone").value = contact.contactNo || "";
      document.getElementById("add_whatsapp").value = contact.whatsappNo || "";
      document.getElementById("add_email").value = contact.email || "";
      document.getElementById("add_company").value = contact.companyName || "";
      const addressInput = document.getElementById("add_address");
      if (addressInput) addressInput.value = contact.address || "";
      document.getElementById("add_position").value = contact.position || "";
      const accountCategoryInput = document.getElementById(
        "add_account_category",
      );
      if (accountCategoryInput) {
        accountCategoryInput.value = contact.accountCategory || "";
        document
          .querySelectorAll(".account-category-button")
          .forEach((button) => {
            button.classList.toggle(
              "selected",
              button.dataset.accountCategory === accountCategoryInput.value,
            );
          });
      }
      document.getElementById("countrySelect").value = contact.country || "";

      const citySelect = document.getElementById("citySelect");
      if (citySelect && contact.city) {
        if (
          ![...citySelect.options].some(
            (option) => option.value === contact.city,
          )
        ) {
          citySelect.add(new Option(contact.city, contact.city));
        }
        citySelect.value = contact.city;
      }

      const saveButton = document.querySelector(
        '.btn-search-main[onclick="saveToFirebase()"]',
      );
      if (saveButton) {
        saveButton.innerHTML = '<i class="fas fa-save"></i> Update Contact';
      }
      document
        .querySelector(".search-section")
        ?.scrollIntoView({ behavior: "smooth" });
    })
    .catch((error) => {
      console.error("Error loading contact for edit:", error);
      alert("Unable to load contact for editing.");
    });
};

// ==========================================
// 4. CONTACT BOOK SYSTEM - UPDATED SEARCH
// ==========================================

window.loadFamilyHeads = function () {
  const familyHeadInput = document.getElementById("invoice_family_head");
  if (!familyHeadInput) return;

  getDatabaseSnapshot("contacts")
    .then((snapshot) => {
      const contacts = snapshot.val() || {};
      window.allFamilyHeadContacts = Object.entries(contacts).filter(
        ([, contact]) =>
          contact.accountCategory?.trim().toLowerCase() === "new customer",
      );
      populateTicketPassengerOptions();
      renderFamilyHeadOptions("");
    })
    .catch((error) => {
      console.error("Error loading family heads:", error);
      const results = document.getElementById("family_head_results");
      if (results) results.textContent = "Unable to load contacts";
    });
};

function renderFamilyHeadOptions(searchTerm) {
  const results = document.getElementById("family_head_results");
  if (!results) return;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matches = (window.allFamilyHeadContacts || []).filter(([, contact]) => {
    const documentNumber =
      contact.documentNo ||
      contact.passportNo ||
      contact.passportNumber ||
      contact.passport ||
      "";
    const searchableText =
      `${contact.contactNo || ""} ${contact.fullName || ""} ${documentNumber}`.toLowerCase();
    return searchableText.includes(normalizedSearch);
  });

  results.innerHTML = "";
  window.familyHeadContacts = {};
  matches.forEach(([key, contact]) => {
    const passportNumber =
      contact.passportNo ||
      contact.passportNumber ||
      contact.passport ||
      contact.documentNo ||
      "-";
    const option = document.createElement("button");
    option.type = "button";
    option.className = "family-head-result";
    option.textContent = `${contact.contactNo || "-"} ${contact.fullName || "-"} ${passportNumber}`;
    option.onclick = () => window.selectFamilyHead(key);
    results.appendChild(option);
    window.familyHeadContacts[key] = { ...contact, passportNumber };
  });

  if (matches.length === 0) {
    results.textContent = "No matching contacts";
  }
}

function populateTicketPassengerOptions() {
  document
    .querySelectorAll("#ticketRows .ticket-passenger-select")
    .forEach((select) => {
      const selectedValue = select.value;
      select.replaceChildren(new Option("Select Passenger", ""));

      (window.allFamilyHeadContacts || []).forEach(([key, contact]) => {
        select.add(new Option(contact.fullName || "-", key));
      });

      if (
        [...select.options].some((option) => option.value === selectedValue)
      ) {
        select.value = selectedValue;
      }
    });
}

window.selectFamilyHead = function (contactKey) {
  const contact = window.familyHeadContacts?.[contactKey];
  const familyHeadInput = document.getElementById("invoice_family_head");
  if (!contact || !familyHeadInput) return;
  familyHeadInput.value = `${contact.contactNo || "-"} ${contact.fullName || "-"} ${contact.passportNumber || "-"}`;
  familyHeadInput.dataset.contactKey = contactKey;
  const passengerSelect = document.getElementById("ticket_passenger");
  if (passengerSelect) passengerSelect.value = contactKey;
  updateTicketSelectionMessage();
  window.fetchFamilyHeadDetail(contactKey);
};

window.handleTicketTypeChange = function (ticketTypeSelect) {
  const row = ticketTypeSelect.closest("tr");
  const ticketNumberInput = row?.querySelector(".ticket-number-input");
  if (!ticketNumberInput) return;

  const autoTicketType = ticketTypeSelect.value === "Auto Ticket No";
  if (!autoTicketType) {
    if (ticketNumberInput.dataset.autoGenerated === "true") {
      ticketNumberInput.value = "";
      delete ticketNumberInput.dataset.autoGenerated;
    }
    ticketNumberInput.readOnly = false;
    return;
  }

  const sequenceKey = "imamTravelsNextAutoTicketNumber";
  const storedSequence = localStorage.getItem(sequenceKey);
  const sequence = storedSequence === null ? 1 : Number(storedSequence);
  const maximumSequence = 9999999999999;
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    sequence > maximumSequence
  ) {
    throw new Error("Auto ticket number sequence is invalid or exhausted.");
  }

  ticketNumberInput.value = String(sequence).padStart(13, "0");
  ticketNumberInput.dataset.autoGenerated = "true";
  ticketNumberInput.readOnly = true;
  localStorage.setItem(sequenceKey, String(sequence + 1));
};

function applyAgentTaxToRow(row, isAgent) {
  const taxInput = row.querySelector(".ticket-tax-input");
  if (!taxInput) return;

  if (isAgent) {
    taxInput.value = "1000";
    taxInput.dataset.agentTax = "true";
    return;
  }

  if (taxInput.dataset.agentTax === "true") {
    if (parseTicketAmount(taxInput.value) === 1000) taxInput.value = "0.00";
    delete taxInput.dataset.agentTax;
  }
}

function parseTicketAmount(value) {
  const amount = Number(String(value || "0").replace(/,/g, "").trim());
  return Number.isFinite(amount) ? amount : 0;
}

function formatTicketAmount(value) {
  return parseTicketAmount(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTicketAmountInputs(container) {
  container
    .querySelectorAll(".ticket-fare-input, .ticket-tax-input, .ticket-sales-input")
    .forEach((input) => {
      input.value = formatTicketAmount(input.value);
    });
}

document
  .querySelectorAll("#ticketRows tr")
  .forEach((row) => formatTicketAmountInputs(row));

function updateTicketAmounts(row) {
  const fareInput = row.querySelector(".ticket-fare-input");
  const taxInput = row.querySelector(".ticket-tax-input");
  const totalFare = row.querySelector(".ticket-total-fare");
  if (!fareInput || !taxInput || !totalFare) return;

  const fare = parseTicketAmount(fareInput.value);
  const taxes = parseTicketAmount(taxInput.value);
  totalFare.textContent = formatTicketAmount(fare + taxes);
}

window.handleClientTypeChange = function (selectedType) {
  window.loadFamilyHeads();
  const isAgent = selectedType === "Agent";
  document
    .querySelectorAll("#ticketRows tr:not(.summary-row)")
    .forEach((row) => {
      applyAgentTaxToRow(row, isAgent);
      updateTicketAmounts(row);
    });
};

document.addEventListener("input", (event) => {
  if (event.target.matches(".ticket-airline-pnr-input")) {
    const row = event.target.closest("tr");
    const gdsPnrInput = row?.querySelector(".ticket-gds-pnr-input");
    if (
      gdsPnrInput &&
      gdsPnrInput.dataset.manuallyEdited !== "true" &&
      (!gdsPnrInput.value || gdsPnrInput.dataset.autoCopied === "true")
    ) {
      gdsPnrInput.value = event.target.value;
      gdsPnrInput.dataset.autoCopied = "true";
    }
  }
  if (event.target.matches(".ticket-gds-pnr-input")) {
    event.target.dataset.manuallyEdited = "true";
    delete event.target.dataset.autoCopied;
  }
  if (event.target.matches(".ticket-tax-input")) {
    delete event.target.dataset.agentTax;
  }
  if (event.target.matches(".ticket-fare-input, .ticket-tax-input")) {
    updateTicketAmounts(event.target.closest("tr"));
  }
  if (
    event.target.matches(
      ".ticket-fare-input, .ticket-tax-input, .ticket-sales-input, .ticket-discount-percent",
    )
  ) {
    updateTicketSummaryPrices();
  }
});

document.addEventListener("focusin", (event) => {
  if (
    event.target.matches(
      ".ticket-fare-input, .ticket-tax-input, .ticket-sales-input",
    )
  ) {
    event.target.value = event.target.value.replace(/,/g, "");
  }
});

document.addEventListener("focusout", (event) => {
  if (
    event.target.matches(
      ".ticket-fare-input, .ticket-tax-input, .ticket-sales-input",
    )
  ) {
    event.target.value = formatTicketAmount(event.target.value);
    updateTicketAmounts(event.target.closest("tr"));
    updateTicketSummaryPrices();
  }
});

function updateTicketSelectionMessage() {
  const message = document.getElementById("ticket-validation-message");
  if (!message || message.hidden) return;

  const supplierMissing = !document.getElementById("supplier_select")?.value;
  const passengerMissing = !document.querySelector(
    "#ticketRows tr.ticket-entry-input-row:not(.ticket-entry-edit-row) .ticket-passenger-select",
  )?.value;

  if (!supplierMissing && !passengerMissing) {
    message.textContent = "";
    message.hidden = true;
    return;
  }

  if (supplierMissing && passengerMissing) {
    message.textContent = "There is no passenger or supplier selected.";
  } else if (supplierMissing) {
    message.textContent = "There is no supplier selected.";
  } else {
    message.textContent = "There is no passenger selected.";
  }
}

document.addEventListener("change", (event) => {
  if (event.target.matches("#ticketRows .ticket-passenger-select")) {
    updateTicketSummaryPrices();
  }
  if (
    event.target.matches(
      "#supplier_select, #ticketRows .ticket-passenger-select",
    )
  ) {
    updateTicketSelectionMessage();
  }
});

let ticketEntryTemplate = null;
const ticketEntryRecords = new Map();
const ticketInvoiceId = push(ref(database, "ticketInvoices")).key;

if (!ticketInvoiceId) {
  throw new Error("Could not create a ticket invoice identifier.");
}

function getTicketEntryRecord(row) {
  const controls = row.querySelectorAll("select, input");
  return {
    passengerId: controls[0].value,
    passengerName: controls[0].selectedOptions[0]?.textContent || "",
    ticketType: controls[1].value,
    ticketNumber: controls[2].value,
    route: controls[3].value,
    carrier: controls[4].value,
    ticketClass: controls[5].value,
    airlinePnr: controls[6].value,
    gdsPnr: controls[7].value,
    fare: controls[8].value.replace(/,/g, ""),
    taxes: controls[9].value.replace(/,/g, ""),
    totalFare: row.querySelector(".ticket-total-fare")?.textContent || "0.00",
    sales: controls[10].value.replace(/,/g, ""),
  };
}

function getTicketBookingData(record) {
  const supplierSelect = document.getElementById("supplier_select");
  const passengerContact = (window.allFamilyHeadContacts || []).find(
    ([key]) => key === record.passengerId,
  )?.[1];
  const supplierName =
    supplierSelect?.selectedOptions[0]?.textContent?.trim() || "";

  return {
    ...record,
    transNo: ticketInvoiceId,
    invoiceId: ticketInvoiceId,
    invoiceDate: document.getElementById("invoice_date")?.value || "",
    travelDate: document.getElementById("travel_date")?.value || "",
    clientType: document.getElementById("cust_type")?.value || "",
    customerContactKey:
      document.getElementById("invoice_family_head")?.dataset.contactKey ||
      record.passengerId,
    contactNo: passengerContact?.contactNo || "",
    supplierContactKey: supplierSelect?.value || "",
    supplierKey: supplierSelect?.value || "",
    supplierName,
    ticketno: record.ticketNumber,
    pnr: record.airlinePnr,
    gdsPnr: record.gdsPnr,
    salePrice: record.sales,
    payment:
      document.querySelector(".payment-area select")?.value || "",
    memo: document.querySelector(".payment-area textarea")?.value || "",
    addedBy: localStorage.getItem("username") || "Admin",
    timestamp: serverTimestamp(),
  };
}

function showTicketSaveError(error) {
  console.error("Unable to save ticket entry:", error);
  const message = document.getElementById("ticket-validation-message");
  if (message) {
    message.textContent = `Unable to save ticket entry: ${error.message || "Please try again."}`;
    message.hidden = false;
  } else {
    alert(`Unable to save ticket entry: ${error.message || "Please try again."}`);
  }
}

function makeTicketEntryInputRow(record, isEditing) {
  const row = ticketEntryTemplate.cloneNode(true);
  row.className = isEditing
    ? "ticket-entry-input-row ticket-entry-edit-row"
    : "ticket-entry-input-row";
  row.querySelectorAll("input").forEach((input) => {
    input.value =
      input.matches(
        ".ticket-fare-input, .ticket-tax-input, .ticket-sales-input",
      ) || input.type === "number"
        ? "0.00"
        : "";
    delete input.dataset.autoCopied;
    delete input.dataset.manuallyEdited;
    input.readOnly = false;
  });
  row.querySelectorAll("select").forEach((select) => {
    select.selectedIndex = 0;
  });

  const passengerSelect = row.querySelector(".ticket-passenger-select");
  if (passengerSelect) {
    passengerSelect.removeAttribute("id");
    if (record) passengerSelect.value = record.passengerId;
  }
  const ticketTypeSelect = row.querySelector(
    'select[onchange*="handleTicketTypeChange"]',
  );
  if (ticketTypeSelect) {
    ticketTypeSelect.value = record?.ticketType || "Ticket No";
  }

  const controls = row.querySelectorAll("select, input");
  if (record) {
    controls[2].value = record.ticketNumber;
    controls[3].value = record.route;
    controls[4].value = record.carrier;
    controls[5].value = record.ticketClass;
    controls[6].value = record.airlinePnr;
    controls[7].value = record.gdsPnr;
    controls[8].value = record.fare;
    controls[9].value = record.taxes;
    controls[10].value = record.sales;
  }

  const addCell = row.querySelector(".add-item-cell");
  if (isEditing) {
    addCell.remove();
    const actionCell = document.createElement("td");
    actionCell.className = "ticket-entry-actions";
    actionCell.innerHTML =
      '<button type="button" class="ticket-entry-save">Save</button> <button type="button" class="ticket-entry-cancel">Cancel</button>';
    row.appendChild(actionCell);
  }

  if (!record) {
    applyAgentTaxToRow(
      row,
      document.getElementById("cust_type")?.value === "Agent",
    );
  }
  formatTicketAmountInputs(row);
  updateTicketAmounts(row);
  return row;
}

function renderSavedTicketEntry(row, record, entryId) {
  row.className = "ticket-entry-saved-row";
  row.dataset.ticketEntryId = entryId;
  row.replaceChildren();

  const values = [
    record.passengerName,
    record.ticketType,
    record.ticketNumber,
    record.route,
    record.carrier,
    record.ticketClass,
    record.airlinePnr,
    record.gdsPnr,
    record.fare,
    record.taxes,
    record.totalFare,
    record.sales,
  ];
  values.forEach((value, index) => {
    const cell = document.createElement("td");
    if (index === 10) cell.className = "amount ticket-total-fare";
    cell.textContent = value || "-";
    row.appendChild(cell);
  });

  const actionCell = document.createElement("td");
  actionCell.className = "ticket-entry-actions";
  actionCell.innerHTML =
    '<button type="button" class="ticket-entry-edit" aria-label="Edit ticket entry"><i class="fa fa-pen" aria-hidden="true"></i></button> <button type="button" class="ticket-entry-delete" aria-label="Delete ticket entry"><i class="fa fa-trash" aria-hidden="true"></i></button>';
  row.appendChild(actionCell);
}

function updateTicketSummaryPrices() {
  const ticketRows = document.getElementById("ticketRows");
  if (!ticketRows) return;

  const discountPercent =
    Number(ticketRows.querySelector(".ticket-discount-percent")?.value) || 0;
  const entries = [...ticketRows.querySelectorAll("tr:not(.summary-row)")];
  const prices = entries.map((row) => {
    const fareInput = row.querySelector(".ticket-fare-input");
    const taxInput = row.querySelector(".ticket-tax-input");
    const salesInput = row.querySelector(".ticket-sales-input");
    const parseAmount = (value) =>
      Number(
        String(value || "0")
          .replace(/,/g, "")
          .trim(),
      ) || 0;
    const fare = parseAmount(fareInput?.value ?? row.cells[8]?.textContent);
    const taxes = parseAmount(taxInput?.value ?? row.cells[9]?.textContent);
    const totalFareValue = row
      .querySelector(".ticket-total-fare")
      ?.textContent.trim();
    const totalFare =
      totalFareValue && totalFareValue !== "-"
        ? parseAmount(totalFareValue)
        : fare + taxes;
    const sales = parseAmount(salesInput?.value ?? row.cells[11]?.textContent);
    const hasTicket = Boolean(
      row.querySelector(".ticket-passenger-select")?.value ||
      row.dataset.ticketEntryId ||
      fare ||
      taxes ||
      sales,
    );

    if (!hasTicket) return "";
    const discountAmount = (fare * discountPercent) / 100;
    const discountedFare = fare - discountAmount;
    const spanPrice =
      sales - (discountedFare + taxes + (sales - (fare + taxes)));
    const totalPrice =
      discountedFare + taxes + (sales - (fare + taxes));
    return {
      spanPrice: formatTicketAmount(Math.round(spanPrice * 100) / 100),
      totalPrice: Math.round(totalPrice * 100) / 100,
      salesMinusTotalFare: Math.round((sales - totalFare) * 100) / 100,
    };
  });

  ticketRows.querySelectorAll(".summary-seven-pieces").forEach((group) => {
    [...group.children].forEach((piece, index) => {
      piece.textContent = prices[index]?.spanPrice || "";
    });
  });

  const amountTotal = ticketRows.querySelector(".total-row .red.amount");
  if (amountTotal) {
    const total = prices.reduce(
      (sum, price) => sum + (Number(price?.totalPrice) || 0),
      0,
    );
    amountTotal.textContent = formatTicketAmount(total);
  }

  const beforeDiscountAmounts =
    ticketRows.querySelectorAll("tr.summary-row")[0]?.querySelectorAll(
      "td.amount",
    );
  if (beforeDiscountAmounts?.[1]) {
    const salesMinusTotalFare = prices.reduce(
      (sum, price) => sum + (Number(price?.salesMinusTotalFare) || 0),
      0,
    );
    beforeDiscountAmounts[1].textContent =
      formatTicketAmount(salesMinusTotalFare);
  }
}

function getCurrentTicketEntryRow(ticketRows) {
  return ticketRows.querySelector(
    "tr.ticket-entry-input-row:not(.ticket-entry-edit-row)",
  );
}

window.addTicketItem = async function () {
  const ticketRows = document.getElementById("ticketRows");
  const inputRow = ticketRows && getCurrentTicketEntryRow(ticketRows);
  if (!ticketRows || !inputRow) return;

  const supplierSelect = document.getElementById("supplier_select");
  const selectedPassenger = inputRow.querySelector(".ticket-passenger-select");
  const missingSupplier = !supplierSelect?.value;
  const missingPassenger = !selectedPassenger?.value;

  if (missingSupplier || missingPassenger) {
    const message = document.getElementById("ticket-validation-message");
    if (message) {
      message.textContent =
        missingSupplier && missingPassenger
          ? "There is no passenger or supplier selected."
          : missingSupplier
            ? "There is no supplier selected."
            : "There is no passenger selected.";
      message.hidden = false;
    }
    (missingSupplier ? supplierSelect : selectedPassenger)?.focus();
    return;
  }

  if (!ticketEntryTemplate) ticketEntryTemplate = inputRow.cloneNode(true);
  const record = getTicketEntryRecord(inputRow);
  const addButton = inputRow.querySelector(".add-item-button");
  if (addButton) addButton.disabled = true;

  try {
    const bookingRef = push(ref(database, "bookings"));
    if (!bookingRef.key) {
      throw new Error("Could not create a ticket entry identifier.");
    }
    await set(bookingRef, getTicketBookingData(record));
    ticketEntryRecords.set(bookingRef.key, record);
    renderSavedTicketEntry(inputRow, record, bookingRef.key);
    const message = document.getElementById("ticket-validation-message");
    if (message) {
      message.textContent = "";
      message.hidden = true;
    }

    const firstSummaryRow = ticketRows.querySelector("tr.summary-row");
    const newInputRow = makeTicketEntryInputRow(null, false);
    ticketRows.insertBefore(newInputRow, firstSummaryRow);
    updateTicketSummaryPrices();
  } catch (error) {
    showTicketSaveError(error);
    if (addButton) addButton.disabled = false;
  }
};

document.getElementById("ticketRows")?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const row = button?.closest("tr");
  if (!button || !row) return;

  if (button.classList.contains("ticket-entry-edit")) {
    const entryId = row.dataset.ticketEntryId;
    const record = ticketEntryRecords.get(entryId);
    if (!entryId || !record) return;
    if (!ticketEntryTemplate) {
      ticketEntryTemplate = getCurrentTicketEntryRow(
        document.getElementById("ticketRows"),
      )?.cloneNode(true);
    }
    if (!ticketEntryTemplate) return;
    const editRow = makeTicketEntryInputRow(record, true);
    editRow.dataset.ticketEntryId = entryId;
    row.replaceWith(editRow);
    updateTicketSummaryPrices();
    return;
  }

  if (button.classList.contains("ticket-entry-save")) {
    const entryId = row.dataset.ticketEntryId;
    if (!entryId) return;
    const record = getTicketEntryRecord(row);
    button.disabled = true;
    update(ref(database, `bookings/${entryId}`), getTicketBookingData(record))
      .then(() => {
        ticketEntryRecords.set(entryId, record);
        renderSavedTicketEntry(row, record, entryId);
        updateTicketSummaryPrices();
      })
      .catch((error) => showTicketSaveError(error))
      .finally(() => {
        button.disabled = false;
      });
    return;
  }

  if (button.classList.contains("ticket-entry-cancel")) {
    const entryId = row.dataset.ticketEntryId;
    const record = ticketEntryRecords.get(entryId);
    if (record) {
      renderSavedTicketEntry(row, record, entryId);
      updateTicketSummaryPrices();
    }
    return;
  }

  if (button.classList.contains("ticket-entry-delete")) {
    const entryId = row.dataset.ticketEntryId;
    if (!entryId) return;
    button.disabled = true;
    remove(ref(database, `bookings/${entryId}`))
      .then(() => {
        ticketEntryRecords.delete(entryId);
        row.remove();
        updateTicketSummaryPrices();
      })
      .catch((error) => {
        showTicketSaveError(error);
        button.disabled = false;
      });
  }
});

window.showFamilyHeadSearch = function () {
  const familyHeadInput = document.getElementById("invoice_family_head");
  if (!familyHeadInput) return;
  renderFamilyHeadOptions(familyHeadInput.value);
  document
    .getElementById("family_head_results")
    ?.classList.add("results-visible");
};

window.toggleFamilyHeadSearch = window.showFamilyHeadSearch;

window.filterFamilyHeads = function (searchTerm) {
  const familyHeadInput = document.getElementById("invoice_family_head");
  if (familyHeadInput) delete familyHeadInput.dataset.contactKey;
  const passengerBalance = document.querySelector(".customer-box .credit-val");
  if (passengerBalance) passengerBalance.textContent = "0.00";
  renderFamilyHeadOptions(searchTerm);
  document
    .getElementById("family_head_results")
    ?.classList.add("results-visible");
};

async function loadSelectedPassengerBalance(contactKey, contact) {
  const balanceElement = document.querySelector(".customer-box .credit-val");
  if (!balanceElement) return;

  balanceElement.textContent = "Loading...";
  try {
    const [
      bookingsSnapshot,
      cashReceiptsSnapshot,
      cashPaymentsSnapshot,
      bankReceiptsSnapshot,
      bankPaymentsSnapshot,
    ] = await Promise.all([
      getDatabaseSnapshot("bookings"),
      getDatabaseSnapshot("cashReceipts"),
      getDatabaseSnapshot("cashPayments"),
      getDatabaseSnapshot("bankReceipts"),
      getDatabaseSnapshot("bankPayments"),
    ]);
    const parseAmount = (value) => {
      const amount = Number.parseFloat(
        String(value || "0")
          .replace(/,/g, "")
          .trim(),
      );
      return Number.isFinite(amount) ? amount : 0;
    };
    const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
    const passengerPhone = normalizePhone(contact.contactNo);
    let balance = 0;

    Object.values(bookingsSnapshot.val() || {}).forEach((booking) => {
      const matchesPassenger = booking.customerContactKey
        ? booking.customerContactKey === contactKey
        : passengerPhone &&
          normalizePhone(booking.contactNo) === passengerPhone;
      if (matchesPassenger) {
        balance += parseAmount(booking.salePrice || booking.totalFare);
      }
    });
    [cashPaymentsSnapshot, bankPaymentsSnapshot].forEach((snapshot) => {
      Object.values(snapshot.val() || {}).forEach((payment) => {
        if (payment.customerContactKey === contactKey) {
          balance += parseAmount(payment.amount);
        }
      });
    });
    [cashReceiptsSnapshot, bankReceiptsSnapshot].forEach((snapshot) => {
      Object.values(snapshot.val() || {}).forEach((receipt) => {
        if (receipt.customerContactKey === contactKey) {
          balance -= parseAmount(receipt.amount);
        }
      });
    });

    const familyHeadInput = document.getElementById("invoice_family_head");
    if (familyHeadInput?.dataset.contactKey !== contactKey) return;
    const sign = balance > 0 ? "-" : balance < 0 ? "+" : "";
    balanceElement.textContent = `${sign}${Math.abs(balance).toLocaleString(
      undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    )}`;
  } catch (error) {
    console.error("Error loading selected passenger balance:", error);
    const familyHeadInput = document.getElementById("invoice_family_head");
    if (familyHeadInput?.dataset.contactKey === contactKey) {
      balanceElement.textContent = "Unable to load";
    }
  }
}

window.fetchFamilyHeadDetail = function (contactKey) {
  const contact = window.familyHeadContacts?.[contactKey];
  const detailsBox = document.getElementById("family_details_box");
  if (!contact) {
    if (detailsBox) detailsBox.style.display = "none";
    return;
  }

  document.getElementById("disp_name").textContent = contact.fullName || "-";
  document.getElementById("disp_passport").textContent =
    contact.passportNumber || contact.passportNo || contact.documentNo || "-";
  document.getElementById("disp_dob").textContent = formatContactDate(
    contact.documentIssueDate || contact.dateOfBirth || contact.dob,
  );
  document.getElementById("disp_expiry").textContent = formatContactDate(
    contact.documentExpiry || contact.passportExpiry || contact.expiryDate,
  );
  loadSelectedPassengerBalance(contactKey, contact);
  document
    .getElementById("family_head_results")
    ?.classList.remove("results-visible");
  if (detailsBox) detailsBox.style.display = "block";
};

function formatContactDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

document.addEventListener("DOMContentLoaded", () => {
  window.loadFamilyHeads();

  const invoiceDate = document.getElementById("invoice_date");
  if (invoiceDate) {
    const today = new Date();
    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    invoiceDate.value = localDate;

    const returnDate = document.getElementById("return_date");
    if (returnDate) {
      returnDate.min = localDate;
      if (!returnDate.value || returnDate.value < localDate) {
        returnDate.value = localDate;
      }
    }
  }

  document.querySelectorAll("input[data-detail-target]").forEach((checkbox) => {
    const detailRow = document.getElementById(checkbox.dataset.detailTarget);
    checkbox.addEventListener("change", () => {
      detailRow?.classList.toggle("detail-visible", checkbox.checked);
    });
  });

  document
    .getElementById("invoice_family_head")
    ?.addEventListener("focus", () => {
      window.showFamilyHeadSearch();
    });

  document.querySelectorAll('input[type="date"]').forEach((dateInput) => {
    dateInput.addEventListener("click", () => {
      if (typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
      }
    });
  });
});

window.handleSearch = function () {
  const normalizeSearchValue = (value) =>
    String(value ?? "")
      .trim()
      .toLocaleLowerCase();
  const userSelect = document.getElementById("filter-user");
  const selectedUser = normalizeSearchValue(
    userSelect ? userSelect.value : "All Users",
  );

  const sCountry = normalizeSearchValue(
    document.getElementById("searchCountry")?.value,
  );
  const sCity = normalizeSearchValue(
    document.getElementById("searchCity")?.value,
  );
  const sName = normalizeSearchValue(
    document.getElementById("searchName")?.value,
  );
  const sPhone = normalizeSearchValue(
    document.getElementById("searchPhone")?.value,
  );
  const sWhatsapp = normalizeSearchValue(
    document.getElementById("searchWhatsapp")?.value,
  );
  const sContactId = normalizeSearchValue(
    document.getElementById("searchContactId")?.value,
  );
  const sCompany = normalizeSearchValue(
    document.getElementById("searchCompany")?.value,
  );

  const tableBody = document.getElementById("serverData");
  if (!tableBody) return;

  tableBody.innerHTML =
    '<tr><td colspan="13" style="text-align:center;">Fetching data from server...</td></tr>';

  // 2. MODULAR SDK GET FUNCTION (v9+)
  get(ref(database, "contacts"))
    .then(async (snapshot) => {
      tableBody.innerHTML = "";
      const data = snapshot.val();

      if (!data) {
        tableBody.innerHTML =
          '<tr><td colspan="13" style="text-align:center;">No records found.</td></tr>';
        return;
      }

      await Promise.all(
        Object.entries(data)
          .filter(
            ([, contact]) =>
              contact &&
              typeof contact === "object" &&
              !contact.contactNumber,
          )
          .map(async ([key]) => {
            const contactNumber = await allocateContactNumber(data);
            const result = await runTransaction(
              ref(database, `contacts/${key}`),
              (current) => {
                if (!current || current.contactNumber) return;
                return { ...current, contactNumber };
              },
            );
            data[key].contactNumber =
              result.snapshot.val()?.contactNumber || contactNumber;
          }),
      );

      Object.keys(data).forEach((key) => {
        const item = data[key];
        if (!item || typeof item !== "object") return;

        const matchesUser =
          selectedUser === "all users" ||
          normalizeSearchValue(item.addedBy) === selectedUser;
        const matchesCountry =
          !sCountry || normalizeSearchValue(item.country) === sCountry;
        const matchesCity =
          !sCity || normalizeSearchValue(item.city).includes(sCity);
        const matchesName =
          !sName || normalizeSearchValue(item.fullName).includes(sName);
        const matchesPhone =
          !sPhone || normalizeSearchValue(item.contactNo).includes(sPhone);
        const matchesWhatsapp =
          !sWhatsapp || normalizeSearchValue(item.whatsappNo).includes(sWhatsapp);
        const matchesContactId =
          !sContactId ||
          normalizeSearchValue(item.contactNumber).includes(sContactId);
        const matchesCompany =
          !sCompany || normalizeSearchValue(item.companyName).includes(sCompany);

        // Sab filters match hon to he row dikhayein
        if (
          matchesUser &&
          matchesCountry &&
          matchesCity &&
          matchesName &&
          matchesPhone &&
          matchesWhatsapp &&
          matchesContactId &&
          matchesCompany
        ) {
          const row = document.createElement("tr");
          [
            item.fullName,
            item.contactNumber,
            item.accountCategory,
            item.contactNo,
            item.whatsappNo,
            item.email,
            item.companyName,
            item.position,
            item.city,
            item.address,
            item.country,
            item.addedBy,
          ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent =
              value === null || value === undefined || value === ""
                ? "-"
                : String(value);
            row.appendChild(cell);
          });

          const actionCell = document.createElement("td");
          const editButton = document.createElement("button");
          editButton.className = "action-btn edit-btn";
          editButton.type = "button";
          editButton.setAttribute("aria-label", "Edit contact");
          const editIcon = document.createElement("i");
          editIcon.className = "fas fa-edit";
          editButton.appendChild(editIcon);
          editButton.addEventListener("click", () => window.editContact(key));
          actionCell.appendChild(editButton);
          row.appendChild(actionCell);
          tableBody.appendChild(row);
        }
      });

      // Agar filtering ke baad koi result na bache
      if (tableBody.rows.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="13" style="text-align:center;">No matching records found.</td></tr>';
      }
    })
    .catch((err) => {
      console.error("Search Error:", err);
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 13;
      cell.style.textAlign = "center";
      cell.style.color = "red";
      cell.textContent = `Search failed: ${err.message}`;
      row.appendChild(cell);
      tableBody.replaceChildren(row);
    });
};

window.clearContactSearch = function () {
  [
    "searchName",
    "searchPhone",
    "searchWhatsapp",
    "searchContactId",
    "searchCountry",
    "searchCity",
  ].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
  window.handleSearch();
};

// Function ko window ke sath attach karein
window.openAddModal = function () {
  const modal = document.getElementById("addUserModal");
  const form = document.getElementById("addUserForm");
  getSignedInUserRecord()
    .then((user) => {
      if (!isOwnerAdminAccount(user)) {
        throw new Error("Only Owner/Admin accounts can add users.");
      }
      if (form) form.reset();
      updateAddUserFields();
      if (modal) modal.style.display = "block";
    })
    .catch((error) => {
      console.error("Unable to load user permissions:", error);
      alert(`Unable to open Add User: ${error.message}`);
    });
};

window.closeAddModal = function () {
  const modal = document.getElementById("addUserModal");
  if (modal) {
    modal.style.display = "none";
    const form = document.getElementById("addUserForm");
    if (form) form.reset();
    updateAddUserFields();
  }
};

window.closeModal = function () {
  const modal = document.getElementById("editUserModal");
  if (modal) modal.style.display = "none";
};

const addUserForm = document.getElementById("addUserForm");
const addUserTypeSelect = document.getElementById("add_user_type");
const addUserDetails = document.getElementById("addUserDetails");
const addAgentParentField = document.getElementById("addAgentParentField");
const addAgentParentSelect = document.getElementById("add_agent_parent");
const addAgentParentStatus = document.getElementById("addAgentParentStatus");
let agentParentRequestId = 0;
let signedInUserRecord = null;
const addUserButton = document.querySelector(".add-btn");

if (addUserButton) {
  getSignedInUserRecord()
    .then((user) => {
      addUserButton.hidden = !isOwnerAdminAccount(user);
    })
    .catch((error) => {
      console.error("Unable to load user-management permissions:", error);
    });
}

function getSignedInUserRole() {
  return (localStorage.getItem("role") || "").trim().toLowerCase();
}

function getSignedInUserId() {
  return localStorage.getItem("uid") || "";
}

function isAgentAccount(user) {
  return (
    String(user?.userType || "")
      .trim()
      .toLowerCase() === "agent"
  );
}

function isOwnerAdminAccount(user, role = getSignedInUserRole()) {
  return (
    role === "admins" &&
    (!user?.userType || String(user.userType).trim().toLowerCase() === "owner")
  );
}

async function getSignedInUserRecord() {
  const role = getSignedInUserRole();
  const userId = getSignedInUserId();
  const authUser = auth.currentUser;
  const authUid = localStorage.getItem("authUid") || "";
  if (!role || !userId) {
    throw new Error("Your login session could not be verified. Please sign in again.");
  }
  if (authUid) {
    if (!authUser || authUser.uid !== authUid) {
      throw new Error("Your Firebase login session could not be verified. Please sign in again.");
    }
    const profileSnapshot = await get(ref(database, `authProfiles/${authUser.uid}`));
    const profile = profileSnapshot.val();
    if (
      !profile ||
      profile.role !== role ||
      profile.userId !== userId ||
      profile.companyid !== localStorage.getItem("companyid")
    ) {
      throw new Error("Your Firebase account is not linked to this application profile.");
    }
  }
  const snapshot = await get(ref(database, `users/${role}/${userId}`));
  signedInUserRecord = snapshot.val();
  if (
    !signedInUserRecord ||
    signedInUserRecord.companyid !== localStorage.getItem("companyid") ||
    (authUid && signedInUserRecord.authUid !== authUser.uid)
  ) {
    throw new Error("Your user account could not be found.");
  }
  return signedInUserRecord;
}

function updateAddUserFields() {
  if (!addUserTypeSelect || !addUserDetails) return;
  const isAgent = addUserTypeSelect.value === "Agent";
  const isSignedInAgent = isAgentAccount(signedInUserRecord);
  const requiresParentSelection = isAgent && !isSignedInAgent;
  if (addAgentParentField && addAgentParentSelect) {
    addAgentParentField.hidden = !requiresParentSelection;
    addAgentParentSelect.disabled = !requiresParentSelection;
    addAgentParentSelect.required = requiresParentSelection;
    if (!requiresParentSelection) {
      agentParentRequestId += 1;
      addAgentParentSelect.value = "";
      if (addAgentParentStatus) addAgentParentStatus.textContent = "";
    } else {
      loadAdminAgentOptions();
    }
  }
  updateAddUserDetailsVisibility();
}

function updateAddUserDetailsVisibility() {
  if (!addUserTypeSelect || !addUserDetails) return;
  const userType = addUserTypeSelect.value;
  const hasAgentChoice =
    addAgentParentSelect?.value && addAgentParentSelect.value !== "";
  const showDetails =
    userType === "Owner" ||
    (userType === "Agent" &&
      (isAgentAccount(signedInUserRecord) || hasAgentChoice));
  addUserDetails.hidden = !showDetails;
  addUserDetails.querySelectorAll("input, select").forEach((field) => {
    field.disabled = !showDetails;
  });
}

async function loadAdminAgentOptions() {
  if (!addAgentParentSelect || !addAgentParentStatus) return;
  const requestId = ++agentParentRequestId;
  addAgentParentSelect.disabled = true;
  addAgentParentStatus.textContent = "Loading admin agents...";
  addAgentParentSelect.replaceChildren(
    new Option("Select an agent", ""),
    new Option("No parent agent", "__none__"),
  );

  try {
    const snapshot = await get(ref(database, "users"));
    const users = snapshot.val() || {};
    signedInUserRecord =
      users[getSignedInUserRole()]?.[getSignedInUserId()] || null;
    if (
      requestId !== agentParentRequestId ||
      addUserTypeSelect?.value !== "Agent"
    ) {
      return;
    }
    const agents = Object.entries(users.admins || {})
      .filter(
        ([, user]) =>
          user &&
          String(user.userType || "")
            .trim()
            .toLowerCase() === "agent",
      )
      .sort(([, first], [, second]) =>
        String(first.username || "").localeCompare(
          String(second.username || ""),
        ),
      );

    agents.forEach(([key, user]) => {
      const details = [user.username, user.email].filter(Boolean).join(" - ");
      addAgentParentSelect.add(new Option(details || "Admin Agent", key));
    });
    addAgentParentSelect.disabled = false;
    addAgentParentStatus.textContent = agents.length
      ? "Select an admin agent, or choose No parent agent."
      : "No admin agents found. Choose No parent agent to create the first one.";
    updateAddUserDetailsVisibility();
  } catch (error) {
    console.error("Error loading admin agents:", error);
    if (requestId !== agentParentRequestId) return;
    addAgentParentSelect.disabled = false;
    addAgentParentStatus.textContent =
      "Unable to load admin agents. Please try selecting Agent again.";
    updateAddUserDetailsVisibility();
  }
}

addUserTypeSelect?.addEventListener("change", () => {
  updateAddUserFields();
});
addAgentParentSelect?.addEventListener("change", () => {
  updateAddUserDetailsVisibility();
});
updateAddUserFields();

if (addUserForm) {
  addUserForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    try {
      const currentUser = await getSignedInUserRecord();
      if (!isOwnerAdminAccount(currentUser)) {
        throw new Error("Only Owner/Admin accounts can add users.");
      }
      const currentUserId = getSignedInUserId();
      const role = document.getElementById("add_role").value;
      const salaryInput = document.getElementById("add_salary").value;
      const selectedAgentId = addAgentParentSelect?.value;
      const parentAgentId = isAgentAccount(currentUser)
        ? currentUserId
        : selectedAgentId && selectedAgentId !== "__none__"
          ? selectedAgentId
          : "";
      const parentAgentUsername = isAgentAccount(currentUser)
        ? currentUser.username || ""
        : selectedAgentId && selectedAgentId !== "__none__"
          ? addAgentParentSelect.selectedOptions[0]?.textContent?.split(
              " - ",
            )[0] || ""
          : "";
      const userData = {
        username: document.getElementById("add_username").value.trim(),
        email: document.getElementById("add_email").value.trim().toLowerCase(),
        companyid: document.getElementById("add_companyid").value,
        salary: salaryInput === "" ? "" : Number(salaryInput),
        userType: addUserTypeSelect.value,
        ...(parentAgentId ? { parentAgentId, parentAgentUsername } : {}),
      };
      const password = document.getElementById("add_password").value;
      if (password.length < 12) {
        throw new Error("New passwords must contain at least 12 characters.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
        throw new Error("Enter a valid email address for the new account.");
      }
      let provisionedUser = null;
      let newUserRef = null;
      try {
        const credential = await createUserWithEmailAndPassword(
          accountProvisioningAuth,
          userData.email,
          password,
        );
        provisionedUser = credential.user;
        userData.authUid = provisionedUser.uid;
        const usersListRef = ref(database, `users/${role}`);
        newUserRef = push(usersListRef);
        await set(newUserRef, userData);
        await set(ref(database, `authProfiles/${provisionedUser.uid}`), {
          role,
          userId: newUserRef.key,
          companyid: userData.companyid,
        });
      } catch (error) {
        if (newUserRef?.key) {
          try {
            await remove(newUserRef);
            if (provisionedUser) {
              await remove(ref(database, `authProfiles/${provisionedUser.uid}`));
            }
          } catch (cleanupError) {
            console.error("Unable to roll back partially created user profile:", cleanupError);
          }
        }
        if (provisionedUser) {
          try {
            await deleteUser(provisionedUser);
          } catch (cleanupError) {
            console.error("Unable to roll back unlinked Firebase account:", cleanupError);
          }
        }
        throw error;
      } finally {
        if (accountProvisioningAuth.currentUser) {
          await signOut(accountProvisioningAuth);
        }
      }
      alert("New User Created Successfully!");
      addUserForm.reset();
      closeAddModal();
      const loadBtn = document.getElementById("loadDataBtn");
      if (loadBtn) loadBtn.click();
    } catch (error) {
      console.error("Error creating user account:", error);
      alert(`Unable to create user: ${error.message}`);
    }
  });
}

// ==========================================
// 5. USER MANAGEMENT (LIVE SERVER DATA WITH SECURE DELETE)
// ==========================================
if (document.getElementById("loadDataBtn")) {
  document.getElementById("loadDataBtn").addEventListener("click", function () {
    const userTableBody = document.getElementById("userTableBody");
    const btn = this;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';

    // Login user ka role check karein (taake unauthorized workers delete na kar sakein)
    const currentUserRole = (localStorage.getItem("role") || "")
      .trim()
      .toLowerCase();
    const currentUserId = localStorage.getItem("uid") || "";

    const usersRef = ref(database, "users");
    onValue(usersRef, (snapshot) => {
      userTableBody.replaceChildren();
      const allData = snapshot.val();
      const currentUser = allData?.[currentUserRole]?.[currentUserId];
      signedInUserRecord = currentUser || null;
      const isAgent = isAgentAccount(currentUser);
      const isOwnerAdmin = isOwnerAdminAccount(currentUser, currentUserRole);
      const addUserButton = document.querySelector(".add-btn");
      if (addUserButton) addUserButton.hidden = !isOwnerAdmin;

      if (allData) {
        let visibleUserCount = 0;
        ["admins", "workers"].forEach((group) => {
          if (allData[group]) {
            Object.keys(allData[group]).forEach((key) => {
              const user = allData[group][key];
              if (isAgent && user.parentAgentId !== currentUserId) return;

              visibleUserCount += 1;
              const row = document.createElement("tr");
              row.dataset.queryId = key;

              const usernameCell = row.insertCell();
              const username = document.createElement("strong");
              username.textContent = user.username || "No Name";
              usernameCell.appendChild(username);
              row.insertCell().textContent = user.email || "N/A";
              const companyCell = row.insertCell();
              const company = document.createElement("code");
              company.textContent = user.companyid || "N/A";
              companyCell.appendChild(company);

              row.insertCell().textContent = user.userType || "N/A";
              const salary =
                user.salary === "" || user.salary === null
                  ? Number.NaN
                  : Number(user.salary);
              row.insertCell().textContent = Number.isFinite(salary)
                ? salary.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "N/A";

              const roleCell = row.insertCell();
              const roleBadge = document.createElement("span");
              roleBadge.className = `badge ${
                group === "admins" ? "badge-admin" : "badge-worker"
              }`;
              roleBadge.textContent = group.toUpperCase();
              roleCell.appendChild(roleBadge);

              const statusCell = row.insertCell();
              const status = document.createElement("span");
              status.className = "status-active";
              status.textContent = "\u25cf Online";
              statusCell.appendChild(status);

              const actionsCell = row.insertCell();
              if (isOwnerAdmin) {
                const editButton = document.createElement("button");
                editButton.className = "action-btn edit-btn";
                editButton.type = "button";
                editButton.setAttribute(
                  "aria-label",
                  `Edit ${user.username || "user"}`,
                );
                const editIcon = document.createElement("i");
                editIcon.className = "fas fa-edit";
                editIcon.style.color = "#ffc107";
                editButton.appendChild(editIcon);
                editButton.addEventListener("click", () => {
                  window.openEditModal(
                    group,
                    key,
                    user.username || "",
                    user.email || "",
                    user.companyid || "",
                    user.userType || "",
                    user.salary ?? "",
                  );
                });
                actionsCell.appendChild(editButton);
              }

              if (isOwnerAdmin && group === "admins" && isAgentAccount(user)) {
                const usersButton = document.createElement("button");
                usersButton.className = "action-btn edit-btn";
                usersButton.type = "button";
                usersButton.textContent = "Users";
                usersButton.setAttribute(
                  "aria-label",
                  `View users for ${user.username || "agent"}`,
                );
                usersButton.addEventListener("click", () => {
                  const params = new URLSearchParams({ agentId: key });
                  window.location.href = `agents_id.html?${params.toString()}`;
                });
                actionsCell.appendChild(usersButton);
              }

              if (isOwnerAdmin) {
                const deleteButton = document.createElement("button");
                deleteButton.className = "action-btn delete-btn";
                deleteButton.type = "button";
                deleteButton.setAttribute(
                  "aria-label",
                  `Delete ${user.username || "user"}`,
                );
                const deleteIcon = document.createElement("i");
                deleteIcon.className = "fas fa-trash-alt";
                deleteButton.appendChild(deleteIcon);
                deleteButton.addEventListener("click", () => {
                  window.deleteUserAccount(
                    `${group}/${key}`,
                    user.username || "",
                  );
                });
                actionsCell.appendChild(deleteButton);
              }
              userTableBody.appendChild(row);
            });
          }
        });
        if (visibleUserCount === 0) {
          const row = userTableBody.insertRow();
          const cell = row.insertCell();
          cell.colSpan = 8;
          cell.textContent = isAgent
            ? "No users are assigned to your Agent account yet."
            : "No users found.";
        }
        btn.innerHTML = '<i class="fas fa-check"></i> Server Sync Done';
      } else {
        const row = userTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 8;
        cell.textContent = "No users found.";
      }
    });
  });
}

const agentUsersBody = document.getElementById("agentUsersBody");
if (agentUsersBody) {
  const agentDetails = document.getElementById("agentDetails");
  const agentUsersStatus = document.getElementById("agentUsersStatus");
  const agentId = new URLSearchParams(window.location.search).get("agentId");

  const showAgentUsersError = (message) => {
    if (agentUsersStatus) agentUsersStatus.textContent = message;
  };

  if (!agentId) {
    showAgentUsersError(
      "No agent was selected. Return to User Management and choose an agent.",
    );
  } else {
    get(ref(database, "users"))
      .then((snapshot) => {
        const users = snapshot.val() || {};
        const agent = users.admins?.[agentId];
        if (
          !agent ||
          String(agent.userType || "")
            .trim()
            .toLowerCase() !== "agent"
        ) {
          throw new Error("The selected Agent account could not be found.");
        }
        const currentUserRole = (localStorage.getItem("role") || "")
          .trim()
          .toLowerCase();
        const currentUserId = localStorage.getItem("uid") || "";
        const currentUser = users[currentUserRole]?.[currentUserId];
        const isCurrentUserAgent =
          String(currentUser?.userType || "")
            .trim()
            .toLowerCase() === "agent";
        if (isCurrentUserAgent && currentUserId !== agentId) {
          throw new Error(
            "You can only view users assigned to your own Agent account.",
          );
        }

        if (agentDetails) {
          agentDetails.textContent = `Users assigned to ${agent.username || "Agent"}`;
        }
        const assignedUsers = ["admins", "workers"].flatMap((group) =>
          Object.entries(users[group] || {})
            .filter(([, user]) => user?.parentAgentId === agentId)
            .map(([key, user]) => ({ group, key, user })),
        );

        agentUsersBody.replaceChildren();
        if (assignedUsers.length === 0) {
          showAgentUsersError("No users have been assigned to this Agent yet.");
          return;
        }

        assignedUsers.forEach(({ group, user }) => {
          const row = agentUsersBody.insertRow();
          row.insertCell().textContent = user.username || "No Name";
          row.insertCell().textContent = user.email || "N/A";
          row.insertCell().textContent = user.companyid || "N/A";
          row.insertCell().textContent = user.userType || "N/A";
          const salary =
            user.salary === "" || user.salary == null
              ? Number.NaN
              : Number(user.salary);
          row.insertCell().textContent = Number.isFinite(salary)
            ? salary.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "N/A";
          row.insertCell().textContent =
            group === "admins" ? "Admin" : "Worker";
        });
        showAgentUsersError(`${assignedUsers.length} assigned user(s).`);
      })
      .catch((error) => {
        console.error("Error loading Agent users:", error);
        showAgentUsersError(`Unable to load Agent users: ${error.message}`);
      });
  }
}

// Modal functions
window.openEditModal = function (
  group,
  key,
  username,
  email,
  companyid,
  userType = "",
  salary = "",
) {
  // Hidden path set karein taake pata chale kis user ko update karna hai
  document.getElementById("edit_user_path").value = `${group}/${key}`;

  // Purana data fill karein
  document.getElementById("edit_username").value = username;
  document.getElementById("edit_email").value = email;
  document.getElementById("edit_companyid").value = companyid;
  document.getElementById("edit_user_type").value = userType;
  document.getElementById("edit_salary").value = salary;
  document.getElementById("edit_role").value = group;

  // Password field ko hamesha khali rakhein (security aur clarity ke liye)
  const passField = document.getElementById("edit_password");
  if (passField) passField.value = "";

  document.getElementById("editUserModal").style.display = "block";
};

// ... upar addUserForm ka code hoga ...

// ==========================================
// EDIT USER LOGIC (YAHAN PASTE KAREIN)
// ==========================================
const editUserForm = document.getElementById("editUserForm");

if (editUserForm) {
  editUserForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const path = document.getElementById("edit_user_path").value;
    const [oldRole, userKey] = path.split("/");
    const newRole = document.getElementById("edit_role").value;
    const newPassword = document.getElementById("edit_password").value;
    const userType = document.getElementById("edit_user_type").value;
    const salaryInput = document.getElementById("edit_salary").value;
    let provisionedUser = null;

    try {
      const currentUser = await getSignedInUserRecord();
      if (!isOwnerAdminAccount(currentUser)) {
        throw new Error("Only Owner/Admin accounts can edit users.");
      }

      const targetRef = ref(database, `users/${path}`);
      const snapshot = await get(targetRef);
      const existingUser = snapshot.val();
      if (!existingUser) throw new Error("The user account no longer exists.");

      const email = document.getElementById("edit_email").value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
      }
      if (existingUser.authUid && email !== existingUser.email?.trim().toLowerCase()) {
        throw new Error("A linked account's email cannot be changed here. Ask that user to update it from their own account.");
      }
      if (newPassword && newPassword.length < 12) {
        throw new Error("Initial passwords must contain at least 12 characters.");
      }

      const mergedData = {
        ...existingUser,
        username: document.getElementById("edit_username").value.trim(),
        email,
        companyid: document.getElementById("edit_companyid").value.trim(),
        ...(userType ? { userType } : {}),
        ...(salaryInput !== "" ? { salary: Number(salaryInput) } : {}),
      };
      delete mergedData.password;

      if (!existingUser.authUid && newPassword) {
        const credential = await createUserWithEmailAndPassword(
          accountProvisioningAuth,
          email,
          newPassword,
        );
        provisionedUser = credential.user;
        mergedData.authUid = provisionedUser.uid;
      }

      const changes = {
        [`users/${newRole}/${userKey}`]: mergedData,
      };
      if (newRole !== oldRole) changes[`users/${oldRole}/${userKey}`] = null;
      if (mergedData.authUid) {
        changes[`authProfiles/${mergedData.authUid}`] = {
          role: newRole,
          userId: userKey,
          companyid: mergedData.companyid,
        };
      }
      await update(ref(database), changes);

      alert(
        existingUser.authUid || provisionedUser
          ? "User account updated successfully."
          : "User updated. Legacy password data was removed; set an initial password here to enable Firebase sign-in.",
      );
      if (newRole !== oldRole) {
        location.reload();
        return;
      }
      document.getElementById("editUserModal").style.display = "none";
      document.getElementById("loadDataBtn").click();
    } catch (error) {
      if (provisionedUser) {
        try {
          await deleteUser(provisionedUser);
        } catch (cleanupError) {
          console.error("Unable to roll back Firebase account provisioning:", cleanupError);
        }
      }
      console.error("Error updating user account:", error);
      alert(`Unable to update user account: ${error.message}`);
    } finally {
      if (accountProvisioningAuth.currentUser) {
        try {
          await signOut(accountProvisioningAuth);
        } catch (error) {
          console.error("Unable to sign out account provisioning session:", error);
        }
      }
    }
  });
}

const sendPasswordResetButton = document.getElementById("sendPasswordResetButton");
if (sendPasswordResetButton) {
  sendPasswordResetButton.addEventListener("click", async () => {
    try {
      const currentUser = await getSignedInUserRecord();
      if (!isOwnerAdminAccount(currentUser)) {
        throw new Error("Only Owner/Admin accounts can send password reset emails.");
      }
      const path = document.getElementById("edit_user_path").value;
      const snapshot = await get(ref(database, `users/${path}`));
      const account = snapshot.val();
      if (!account?.authUid) {
        throw new Error("Migrate this legacy account by setting an initial password before sending a reset email.");
      }
      await sendPasswordResetEmail(auth, account.email);
      alert(`Password reset email sent to ${account.email}.`);
    } catch (error) {
      console.error("Unable to send password reset email:", error);
      alert(`Unable to send password reset email: ${error.message}`);
    }
  });
}

function finishUpdate() {
  alert("User Data Updated Successfully!");
  closeModal();
  document.getElementById("loadDataBtn").click(); // Refresh table
}

window.deleteUserAccount = async function (path, username) {
  try {
    const currentUser = await getSignedInUserRecord();
    const currentUserRole = getSignedInUserRole();
    if (!isOwnerAdminAccount(currentUser, currentUserRole)) {
      throw new Error("Only Owner/Admin accounts can delete users.");
    }
    const [targetRole, targetId] = path.split("/");
    const targetSnapshot = await get(ref(database, `users/${path}`));
    const targetUser = targetSnapshot.val();
    if (!targetUser) throw new Error("The user account no longer exists.");

    if (
      !confirm(
        `⚠️ DANGER: Kya aap waqai "${username}" ka account hamesha ke liye delete karna chahte hain?`,
      )
    ) {
      return;
    }

    const deletionPaths = {
      [`users/${targetRole}/${targetId}`]: null,
    };
    if (targetUser.authUid) {
      deletionPaths[`authProfiles/${targetUser.authUid}`] = null;
    }
    await update(ref(database), deletionPaths);
    alert(`Success: User "${username}" ko server se delete kar diya gaya hai.`);
    const loadBtn = document.getElementById("loadDataBtn");
    if (loadBtn) loadBtn.click();
  } catch (error) {
    console.error("Delete Error:", error);
    alert(`Unable to delete user: ${error.message}`);
  }
};

// ==========================================
// 6. QUERY MANAGEMENT SYSTEM (New)
// ==========================================

function loadQueryContactDropdown() {
  const contactSelect = document.getElementById("q_contact_select");
  const sourceSelect = document.getElementById("q_source");
  if (!contactSelect && !sourceSelect) return;

  get(ref(database, "contacts"))
    .then((snapshot) => {
      const contacts = snapshot.val() || {};
      const sortedContacts = Object.entries(contacts).sort(
        ([, first], [, second]) =>
          (first.fullName || "").localeCompare(second.fullName || ""),
      );

      window.queryContactsByKey = {};
      const sourceContactGroup = sourceSelect
        ? document.createElement("optgroup")
        : null;
      if (sourceContactGroup) {
        sourceContactGroup.label = "Contact Book";
      }

      sortedContacts.forEach(([key, contact]) => {
        window.queryContactsByKey[key] = contact;
        const contactLabel = [
          contact.fullName || "Unnamed Contact",
          contact.clientType,
          contact.contactNo,
        ]
          .filter(Boolean)
          .join(" - ");

        if (contactSelect) {
          const option = document.createElement("option");
          option.value = key;
          option.textContent = contactLabel;
          contactSelect.appendChild(option);
        }

        if (sourceContactGroup) {
          const sourceOption = document.createElement("option");
          sourceOption.value = contact.fullName || "Unnamed Contact";
          sourceOption.textContent = contactLabel;
          sourceContactGroup.appendChild(sourceOption);
        }
      });

      if (sourceContactGroup?.childElementCount) {
        sourceSelect.appendChild(sourceContactGroup);
      }

      contactSelect?.addEventListener("change", () => {
        const contact = window.queryContactsByKey[contactSelect.value];
        if (!contact) return;

        document.getElementById("q_name").value = contact.fullName || "";
        document.getElementById("q_mobile").value = contact.contactNo || "";
        document.getElementById("q_whatsapp").value = contact.whatsappNo || "";
        document.getElementById("q_email").value = contact.email || "";
        document.getElementById("q_business_name").value =
          contact.companyName || "";

        const citySelect = document.getElementById("q_city");
        if (citySelect) {
          citySelect.value = contact.city || "";
        }
      });
    })
    .catch((error) => {
      console.error("Contact Book load error:", error);
    });
}

function loadQueryForwardedUsers() {
  const userSelect = document.getElementById("q_forwarded_to");
  if (!userSelect) return;

  get(ref(database, "users"))
    .then((snapshot) => {
      const users = snapshot.val() || {};
      const forwardedUsers = ["admins", "workers"]
        .flatMap((group) =>
          Object.entries(users[group] || {}).map(([userId, user]) => ({
            userId,
            role: group,
            username: user.username?.trim(),
          })),
        )
        .filter((user) => user.username)
        .sort((first, second) => first.username.localeCompare(second.username));

      forwardedUsers.forEach(({ role, userId, username }) => {
        const option = document.createElement("option");
        option.value = `${role}/${userId}`;
        option.textContent = username;
        userSelect.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("Accounts users load error:", error);
    });
}

const NOTIFICATION_REMINDER_INTERVAL = 60 * 60 * 1000;

async function notifyQueryCreator(queryRecord, queryId, responseStatus) {
  let creatorRole = queryRecord.createdByRole;
  let creatorUserId = queryRecord.createdByUserId;

  if (!creatorRole || !creatorUserId) {
    const usersSnapshot = await get(ref(database, "users"));
    const users = usersSnapshot.val() || {};
    for (const group of ["admins", "workers"]) {
      const creatorEntry = Object.entries(users[group] || {}).find(
        ([, user]) =>
          user.username === queryRecord.assignedBy ||
          (queryRecord.assignedById &&
            user.companyid === queryRecord.assignedById),
      );
      if (creatorEntry) {
        creatorRole = group;
        creatorUserId = creatorEntry[0];
        break;
      }
    }
  }

  if (!creatorRole || !creatorUserId) return false;

  const completed = responseStatus === "done";
  await push(ref(database, `notifications/${creatorRole}/${creatorUserId}`), {
    kind: "query-response",
    title: completed ? "Query completed" : "Query is being worked on",
    message: completed
      ? `${localStorage.getItem("username") || "The assigned user"} marked query ${queryRecord.name || ""} as complete.`
      : `${localStorage.getItem("username") || "The assigned user"} started working on query ${queryRecord.name || ""}.`,
    queryId,
    read: false,
    timestamp: serverTimestamp(),
  });
  return true;
}

let querySequenceInitPromise = null;
let queryNumberMigrationPromise = null;

function querySequenceValue(value) {
  const match = String(value || "").match(/(\d+)$/);
  return Number(match?.[1] || 0);
}

async function initializeQuerySequence(existingQueries) {
  if (!querySequenceInitPromise) {
    querySequenceInitPromise = (async () => {
      let queries = existingQueries;
      if (!queries) {
        const snapshot = await get(ref(database, "queries"));
        queries = snapshot.val() || {};
      }

      const highestNumber = Object.values(queries).reduce(
        (highest, query) =>
          Math.max(highest, querySequenceValue(query.queryNumber)),
        0,
      );
      await runTransaction(ref(database, "querySequence"), (current) =>
        Math.max(Number(current) || 0, highestNumber),
      );
    })().catch((error) => {
      querySequenceInitPromise = null;
      throw error;
    });
  }

  await querySequenceInitPromise;
}

async function allocateQueryNumber() {
  await initializeQuerySequence();
  const result = await runTransaction(
    ref(database, "querySequence"),
    (current) => (Number(current) || 0) + 1,
  );
  if (!result.committed) throw new Error("Could not allocate a query number.");
  return `Q-${String(result.snapshot.val()).padStart(5, "0")}`;
}

async function assignMissingQueryNumbers(queries) {
  if (queryNumberMigrationPromise) return queryNumberMigrationPromise;

  queryNumberMigrationPromise = (async () => {
    await initializeQuerySequence(queries);
    const missingQueries = Object.entries(queries).filter(
      ([, query]) => !query.queryNumber,
    );

    await Promise.all(
      missingQueries.map(async ([queryId]) => {
        const queryNumber = await allocateQueryNumber();
        await runTransaction(ref(database, `queries/${queryId}`), (current) => {
          if (!current || current.queryNumber) return;
          return { ...current, queryNumber };
        });
      }),
    );
  })();

  try {
    await queryNumberMigrationPromise;
  } finally {
    queryNumberMigrationPromise = null;
  }
}

function loadUserNotifications() {
  const notificationPopup = document.querySelector(".notification-popup");
  const notificationCount = document.querySelector(".notification-count");
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  if (!notificationPopup || !role) return;

  const notificationList = document.createElement("div");
  notificationList.className = "notification-list";
  notificationPopup.replaceChildren(
    notificationPopup.querySelector("strong"),
    notificationList,
  );

  const notificationTrigger = document.querySelector(
    ".notification-menu summary",
  );
  notificationTrigger?.addEventListener("click", () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch((error) => {
        console.warn("Notification permission request failed:", error);
      });
    }
  });

  let hasInitialSnapshot = false;
  const knownNotificationIds = new Set();
  const reminderTimers = new Map();
  const calendarReminderTimers = new Map();
  const calendarEventTypeLabels = {
    work: "Work",
    travel: "Travel",
    ticket: "Ticket",
    "ticket-refund": "Ticket refund",
    "vendor-payment": "Vendor payment",
    recovery: "Payment recovery",
    flight: "Flight departure",
    visa: "Visa",
    hotel: "Hotel",
    umrah: "Umrah / Hajj",
    "client-meeting": "Client meeting",
    "document-expiry": "Document expiry",
    "follow-up": "Customer follow-up",
    personal: "Personal",
    reminder: "Reminder",
  };

  const subscribeToCalendarReminders = (userId) => {
    const companyId = localStorage.getItem("companyid") || "";
    if (!companyId || !userId) return;
    const companyKey = encodeURIComponent(companyId).replace(/\./g, "%2E");
    const userKey = `${role}_${userId}`;
    const scheduledRemindersKey = `calendarReminderSent:${companyKey}:${userKey}`;
    const maxTimerDelay = 2147483647;
    let scheduledReminders = new Set();
    try {
      const savedReminders = JSON.parse(
        localStorage.getItem(scheduledRemindersKey) || "[]",
      );
      if (Array.isArray(savedReminders)) {
        scheduledReminders = new Set(savedReminders.filter((item) => typeof item === "string"));
      }
    } catch (error) {
      console.error("Unable to load sent calendar reminder records:", error);
    }

    const getReminderLabel = (event, reminderType, repeatNumber) => {
      const type = calendarEventTypeLabels[event.category] || "Event";
      if (repeatNumber) {
        return `${type} reminder (${repeatNumber})`;
      }
      return reminderType === "day-before"
        ? `${type} reminder · starts tomorrow`
        : `${type} reminder · starts now`;
    };

    const sendCalendarReminder = async (
      event,
      reminderKey,
      reminderType,
      repeatNumber,
    ) => {
      if (scheduledReminders.has(reminderKey)) return;
      try {
        const sentAcrossTabs = JSON.parse(
          localStorage.getItem(scheduledRemindersKey) || "[]",
        );
        if (Array.isArray(sentAcrossTabs) && sentAcrossTabs.includes(reminderKey)) {
          scheduledReminders.add(reminderKey);
          return;
        }
      } catch (error) {
        console.error("Unable to check calendar reminder delivery state:", error);
        return;
      }
      scheduledReminders.add(reminderKey);
      try {
        localStorage.setItem(
          scheduledRemindersKey,
          JSON.stringify(Array.from(scheduledReminders).slice(-1000)),
        );
      } catch (error) {
        scheduledReminders.delete(reminderKey);
        console.error("Unable to save sent calendar reminder state:", error);
        return;
      }

      try {
        await push(ref(database, `notifications/${role}/${userId}`), {
          kind: "calendar-event-reminder",
          title: getReminderLabel(event, reminderType, repeatNumber),
          message: `${event.title}${event.time ? ` · ${event.time}` : " · All day"}${event.createdByName ? ` · Added by ${event.createdByName}` : ""}`,
          eventId: event.id,
          read: false,
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        scheduledReminders.delete(reminderKey);
        try {
          localStorage.setItem(
            scheduledRemindersKey,
            JSON.stringify(Array.from(scheduledReminders)),
          );
        } catch (storageError) {
          console.error("Unable to reset failed calendar reminder state:", storageError);
        }
        console.error("Unable to send calendar event reminder:", error);
      }
    };

    const setReminderTimer = (event, reminderAt, reminderType, repeatNumber, reminderKey) => {
      const timerKey = reminderKey;
      if (scheduledReminders.has(reminderKey)) return;
      if (calendarReminderTimers.has(timerKey)) {
        clearTimeout(calendarReminderTimers.get(timerKey));
      }
      const delay = reminderAt - Date.now();
      if (delay <= 0) return;
      const timer = setTimeout(() => {
        calendarReminderTimers.delete(timerKey);
        if (reminderAt - Date.now() > 0) {
          setReminderTimer(event, reminderAt, reminderType, repeatNumber, reminderKey);
        } else {
          sendCalendarReminder(event, reminderKey, reminderType, repeatNumber);
        }
      }, Math.min(delay, maxTimerDelay));
      calendarReminderTimers.set(timerKey, timer);
    };

    onValue(
      ref(database, `calendarEvents/${companyKey}/${userKey}`),
      (snapshot) => {
        for (const timer of calendarReminderTimers.values()) clearTimeout(timer);
        calendarReminderTimers.clear();
        const savedEvents = snapshot.val() || {};
        Object.entries(savedEvents).forEach(([eventId, event]) => {
          if (
            !event ||
            event.companyId !== companyId ||
            (event.createdByKey !== userKey && !(event.sharedWith || []).includes(userKey)) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(event.date)
          ) {
            return;
          }

          const settings = event.reminders || { atEventTime: true };
          if (settings.atEventTime === false && !settings.oneDayBefore) return;
          const time = /^\d{2}:\d{2}$/.test(event.time || "") ? event.time : "09:00";
          const eventAt = new Date(`${event.date}T${time}:00`).getTime();
          if (!Number.isFinite(eventAt)) return;
          const reminderStarts = [];
          if (settings.atEventTime !== false) {
            reminderStarts.push({ at: eventAt, type: "event-time" });
          }
          if (settings.oneDayBefore) {
            reminderStarts.push({ at: eventAt - 24 * 60 * 60 * 1000, type: "day-before" });
          }

          let repeatInterval = Number(settings.repeatInterval) || 30;
          if (settings.repeatUnit === "minutes") repeatInterval *= 60 * 1000;
          else if (settings.repeatUnit === "days") repeatInterval *= 24 * 60 * 60 * 1000;
          else repeatInterval *= 60 * 60 * 1000;
          const repeatCount = settings.repeatEnabled
            ? Math.min(20, Math.max(0, Number(settings.repeatCount) || 0))
            : 0;

          reminderStarts.forEach(({ at, type }) => {
            for (let repeatNumber = 0; repeatNumber <= repeatCount; repeatNumber += 1) {
              const reminderAt = at + repeatInterval * repeatNumber;
              const reminderKey = [
                eventId,
                event.updatedAt || event.createdAt || "",
                type,
                repeatNumber,
                reminderAt,
              ].join(":");
              setReminderTimer(
                { ...event, id: eventId },
                reminderAt,
                type,
                repeatNumber,
                reminderKey,
              );
            }
          });
        });
      },
      (error) => {
        console.error("Calendar reminder subscription failed:", error);
      },
    );
  };

  const subscribeToNotifications = (userId) => {
    if (!userId) return;
    subscribeToCalendarReminders(userId);

    const scheduleReminder = (notificationId, notification) => {
      const existingTimer = reminderTimers.get(notificationId);
      if (existingTimer) clearTimeout(existingTimer);

      if (
        notification.kind === "query-response" ||
        notification.responseStatus !== "pending"
      ) {
        reminderTimers.delete(notificationId);
        return;
      }

      const reminderAt = Number(notification.remindAt);
      if (!Number.isFinite(reminderAt)) return;

      const timer = setTimeout(
        async () => {
          try {
            const notificationRef = ref(
              database,
              `notifications/${role}/${userId}/${notificationId}`,
            );
            const result = await runTransaction(notificationRef, (current) => {
              if (
                !current ||
                current.responseStatus !== "pending" ||
                Number(current.remindAt) !== reminderAt
              ) {
                return;
              }

              const now = Date.now();
              return {
                ...current,
                remindAt: now + NOTIFICATION_REMINDER_INTERVAL,
                lastReminderAt: now,
                reminderCount: (current.reminderCount || 0) + 1,
              };
            });

            if (
              result.committed &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification("Query reminder", {
                body: "You have a query waiting for your response.",
                tag: `query-reminder-${notificationId}`,
              });
            }
          } catch (error) {
            console.error("Query reminder failed:", error);
          }
        },
        Math.max(0, reminderAt - Date.now()),
      );

      reminderTimers.set(notificationId, timer);
    };

    const handleQueryResponse = async (
      notificationId,
      notification,
      responseStatus,
      button,
    ) => {
      const notificationRef = ref(
        database,
        `notifications/${role}/${userId}/${notificationId}`,
      );
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Saving...";

      try {
        if (responseStatus === "later") {
          await update(notificationRef, {
            responseStatus: "pending",
            lastAction: "later",
            remindAt: Date.now() + NOTIFICATION_REMINDER_INTERVAL,
          });
          return;
        }

        const queryRef = ref(database, `queries/${notification.queryId}`);
        const querySnapshot = await get(queryRef);
        const queryRecord = querySnapshot.val();
        if (!queryRecord)
          throw new Error("The assigned query could not be found.");

        if (responseStatus === "working") {
          await update(queryRef, { status: "Processing" });
          await update(notificationRef, {
            responseStatus: "working",
            lastAction: "working",
            remindAt: null,
            respondedAt: Date.now(),
          });

          if (notification.responseStatus !== "working") {
            const creatorNotified = await notifyQueryCreator(
              queryRecord,
              notification.queryId,
              responseStatus,
            );
            if (!creatorNotified) {
              alert(
                "Query updated, but its creator could not be identified for notification.",
              );
            }
          }
        } else {
          await update(queryRef, { status: "Done" });
          const creatorNotified = await notifyQueryCreator(
            queryRecord,
            notification.queryId,
            responseStatus,
          );
          await remove(notificationRef);
          reminderTimers.delete(notificationId);
          if (!creatorNotified) {
            alert(
              "Query completed, but its creator could not be identified for notification.",
            );
          }
        }
      } catch (error) {
        console.error("Query response failed:", error);
        alert(`Unable to update this query: ${error.message}`);
        button.disabled = false;
        button.textContent = originalText;
      }
    };

    onValue(ref(database, `notifications/${role}/${userId}`), (snapshot) => {
      const notificationEntries = Object.entries(
        snapshot.val() || {},
      ).reverse();
      const unreadNotifications = notificationEntries.filter(
        ([, notification]) => !notification.read,
      ).length;
      if (notificationCount) {
        notificationCount.textContent =
          unreadNotifications > 99 ? "99+" : String(unreadNotifications);
        notificationCount.hidden = unreadNotifications === 0;
      }
      notificationTrigger?.setAttribute(
        "aria-label",
        unreadNotifications
          ? `Notifications, ${unreadNotifications} unread`
          : "Notifications",
      );
      notificationList.replaceChildren();

      if (notificationEntries.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No new notifications";
        notificationList.appendChild(emptyMessage);
        hasInitialSnapshot = true;
        return;
      }

      notificationEntries.forEach(([notificationId, notification]) => {
        if (
          notification.kind !== "query-response" &&
          notification.queryId &&
          !notification.responseStatus
        ) {
          notification = {
            ...notification,
            kind: "query-assigned",
            responseStatus: "pending",
            remindAt: Date.now() + NOTIFICATION_REMINDER_INTERVAL,
          };
          update(
            ref(database, `notifications/${role}/${userId}/${notificationId}`),
            {
              kind: notification.kind,
              responseStatus: notification.responseStatus,
              remindAt: notification.remindAt,
            },
          ).catch((error) => {
            console.error("Notification reminder setup failed:", error);
          });
        }
        scheduleReminder(notificationId, notification);

        if (
          hasInitialSnapshot &&
          !knownNotificationIds.has(notificationId) &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(notification.title || "Notification", {
              body: notification.message || "",
              tag: notificationId,
            });
          } catch (error) {
            console.warn("Browser notification could not be displayed:", error);
          }
        }
        knownNotificationIds.add(notificationId);
      });
      hasInitialSnapshot = true;

      notificationEntries
        .slice(0, 8)
        .forEach(([notificationId, notification]) => {
          const item = document.createElement("div");
          item.className = "notification-item";
          if (notification.read) item.classList.add("is-read");
          const queryLink = document.createElement("a");
          queryLink.className = "notification-link";
          queryLink.href =
            notification.kind === "calendar-event"
              ? "calendar.html"
              : "query_inquiry.html";
          const title = document.createElement("strong");
          title.textContent = notification.title || "Notification";
          const message = document.createElement("p");
          message.textContent = notification.assignedBy
            ? `A new query added by ${notification.assignedBy} has been assigned to you.`
            : notification.message || "";
          if (!notification.assignedBy && notification.queryId) {
            get(ref(database, `queries/${notification.queryId}`))
              .then((querySnapshot) => {
                const query = querySnapshot.val();
                if (query?.assignedBy) {
                  message.textContent = `A new query added by ${query.assignedBy} has been assigned to you.`;
                }
              })
              .catch((error) => {
                console.error("Query notification details load error:", error);
              });
          }
          if (notification.lastAction === "later") {
            message.textContent += " Reminder set for 1 hour.";
          } else if (notification.lastAction === "working") {
            message.textContent += " You are working on this query.";
          } else if (notification.lastReminderAt) {
            message.textContent +=
              " Reminder: this query is still waiting for your response.";
          }
          queryLink.append(title, message);
          item.appendChild(queryLink);

          const readControl = document.createElement("label");
          readControl.className = "notification-read-control";
          const readCheckbox = document.createElement("input");
          readCheckbox.type = "checkbox";
          readCheckbox.checked = Boolean(notification.read);
          readCheckbox.setAttribute(
            "aria-label",
            `Mark ${title.textContent} as read`,
          );
          readCheckbox.addEventListener("change", async () => {
            const wasRead = Boolean(notification.read);
            readCheckbox.disabled = true;
            try {
              await update(
                ref(
                  database,
                  `notifications/${role}/${userId}/${notificationId}`,
                ),
                { read: readCheckbox.checked },
              );
            } catch (error) {
              console.error("Notification read status update failed:", error);
              readCheckbox.checked = wasRead;
              alert("Unable to update the notification read status.");
            } finally {
              readCheckbox.disabled = false;
            }
          });
          const readLabel = document.createElement("span");
          readLabel.textContent = "Mark as read";
          readControl.append(readCheckbox, readLabel);
          item.appendChild(readControl);

          if (
            notification.queryId &&
            notification.kind !== "query-response" &&
            ["pending", "working"].includes(notification.responseStatus)
          ) {
            const actions = document.createElement("div");
            actions.className = "notification-actions";
            [
              ["done", "Done"],
              ["working", "Working"],
              ["later", "Later"],
            ].forEach(([responseStatus, label]) => {
              const button = document.createElement("button");
              button.type = "button";
              button.textContent = label;
              button.addEventListener("click", () => {
                handleQueryResponse(
                  notificationId,
                  notification,
                  responseStatus,
                  button,
                );
              });
              actions.appendChild(button);
            });
            item.appendChild(actions);
          }
          notificationList.appendChild(item);
        });
    });
  };

  const storedUserId = localStorage.getItem("uid");
  if (storedUserId) {
    subscribeToNotifications(storedUserId);
    return;
  }

  if (username) {
    get(ref(database, `users/${role}`))
      .then((snapshot) => {
        const userEntry = Object.entries(snapshot.val() || {}).find(
          ([, user]) => user.username === username,
        );
        if (!userEntry) return;
        const [userId] = userEntry;
        localStorage.setItem("uid", userId);
        subscribeToNotifications(userId);
      })
      .catch((error) => console.error("Notifications load error:", error));
  }
}

window.saveQueryToFirebase = function () {
  const forwardedUserSelect = document.getElementById("q_forwarded_to");
  const forwardedUserPath = forwardedUserSelect?.value || "";
  const selectedForwardedUser = forwardedUserPath
    ? forwardedUserSelect.selectedOptions[0]?.textContent || "-"
    : "-";

  // 1. Data collect karein
  const queryData = {
    date: document.getElementById("date")?.value || "",
    name: document.getElementById("q_name")?.value || "",
    mobile: document.getElementById("q_mobile")?.value || "",
    whatsapp: document.getElementById("q_whatsapp")?.value || "",
    email: document.getElementById("q_email")?.value || "",
    city: document.getElementById("q_city")?.value || "",
    type: document.getElementById("q_type")?.value || "GENERAL INFORMATION",
    source: document.getElementById("q_source")?.value || "PHONE",
    description: document.getElementById("q_description")?.value || "",
    forwardedTo: selectedForwardedUser,
    forwardedToId: forwardedUserPath,
    assignedBy: localStorage.getItem("username") || "HASEEB RAZA",
    assignedById: localStorage.getItem("companyid") || "-",
    createdByRole: localStorage.getItem("role") || "",
    createdByUserId: localStorage.getItem("uid") || "",
    status: document.getElementById("q_status")?.value || "Active",
    timestamp: serverTimestamp(), // Yeh serverTimestamp aapne import kiya hua hai
  };

  // 2. Validation
  if (!queryData.name || !queryData.mobile) {
    alert("Please fill Name and Mobile number!");
    return;
  }

  // 3. FIX: Modular Syntax use karein
  // ref(database, 'queries').push(queryData) <-- Yeh galat tha
  const newQueryRef = push(ref(database, "queries"));

  allocateQueryNumber()
    .then((queryNumber) => {
      queryData.queryNumber = queryNumber;
      return set(newQueryRef, queryData);
    })
    .then(async () => {
      if (forwardedUserPath) {
        const [targetRole, targetUserId] = forwardedUserPath.split("/");
        try {
          await push(
            ref(database, `notifications/${targetRole}/${targetUserId}`),
            {
              title: "New query assigned",
              message: `A new query added by ${queryData.assignedBy} has been assigned to you.`,
              assignedBy: queryData.assignedBy,
              assignedById: queryData.assignedById,
              kind: "query-assigned",
              responseStatus: "pending",
              remindAt: Date.now() + NOTIFICATION_REMINDER_INTERVAL,
              reminderCount: 0,
              queryId: newQueryRef.key,
              read: false,
              timestamp: serverTimestamp(),
            },
          );
        } catch (notificationError) {
          console.error("Notification Error:", notificationError);
          alert("Query saved, but the notification could not be sent.");
          window.location.href = "query_inquiry.html";
          return;
        }
      }

      alert("Query Saved Successfully!");
      window.location.href = "query_inquiry.html";
    })
    .catch((err) => {
      console.error("Save Error:", err);
      alert("Error: " + err.message);
    });
};

// --- SERVER SE DATA LANE KA FUNCTION (MODIFIED) ---
function formatFollowUpDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB");
}

function formatFollowUpTimestamp(value) {
  if (!value) return { date: "-", time: "-" };
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return { date: "-", time: "-" };

  const savedAt = new Date(timestamp);
  if (Number.isNaN(savedAt.getTime())) return { date: "-", time: "-" };

  return {
    date: savedAt.toLocaleDateString("en-GB"),
    time: savedAt.toLocaleTimeString("en-GB"),
  };
}

function findFollowUpUsername(entry) {
  const users = window.followUpUsers || {};
  const roles = entry.userRole ? [entry.userRole] : ["admins", "workers"];
  for (const role of roles) {
    const user = users[role]?.[entry.userId];
    if (user?.username) return user.username;
  }

  return entry.user || "Unknown user";
}

function renderFollowUpHistory(followUps) {
  const history = document.querySelector(".follow-up-history");
  if (!history) return;
  history.replaceChildren();

  const entries = Object.values(followUps || {}).sort((first, second) =>
    (first.date || "").localeCompare(second.date || ""),
  );
  if (entries.length === 0) {
    history.textContent = "No follow-up messages yet.";
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "follow-up-entry";
    const date = document.createElement("span");
    date.textContent = formatFollowUpDate(entry.date);
    date.title = "Follow-up date";
    const comment = document.createElement("span");
    comment.textContent = entry.comment || "";
    const user = document.createElement("span");
    user.textContent = findFollowUpUsername(entry);
    user.title = entry.userId ? `User ID: ${entry.userId}` : "Saved by";
    const savedAt = document.createElement("span");
    const timestamp = formatFollowUpTimestamp(entry.timestamp);
    savedAt.textContent = `${timestamp.date} ${timestamp.time}`;
    savedAt.title = "Saved on server";
    row.append(date, comment, user, savedAt);
    history.appendChild(row);
  });
}

async function initializeFollowUpWindow() {
  const queryId = new URLSearchParams(window.location.search).get("queryId");
  const queryTitle = document.querySelector(".follow-up-query");
  const form = document.getElementById("follow-up-form");
  const dateInput = document.getElementById("follow-up-date");
  const commentInput = document.getElementById("follow-up-comment");
  const status = document.querySelector(".follow-up-status");
  if (!queryId || !queryTitle || !form || !dateInput || !commentInput) {
    if (status) status.textContent = "The query ID is missing or invalid.";
    return;
  }

  form.dataset.queryId = queryId;
  const today = new Date();
  dateInput.value = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  queryTitle.textContent = "Loading query...";
  renderFollowUpHistory({});

  try {
    const [querySnapshot, usersSnapshot] = await Promise.all([
      get(ref(database, `queries/${queryId}`)),
      get(ref(database, "users")),
    ]);
    const queryRecord = querySnapshot.val();
    if (!queryRecord) throw new Error("The selected query could not be found.");
    window.followUpUsers = usersSnapshot.val() || {};
    queryTitle.textContent = `${queryRecord.queryNumber || "Query"} — ${queryRecord.name || ""}`;
    renderFollowUpHistory(queryRecord.followUps);
  } catch (error) {
    console.error("Unable to open query follow-up:", error);
    if (status)
      status.textContent = `Unable to load follow-up: ${error.message}`;
  }
}

if (window.location.pathname.includes("query_follow_up.html")) {
  initializeFollowUpWindow();
}

document
  .getElementById("follow-up-form")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const history = document.querySelector(".follow-up-history");
    const status = document.querySelector(".follow-up-status");
    const date = document.getElementById("follow-up-date").value;
    const comment = document.getElementById("follow-up-comment").value.trim();
    const queryId = form.dataset.queryId;
    const saveButton = form.querySelector(".btn-follow-up-save");
    if (!queryId || !date || !comment) return;

    saveButton.disabled = true;
    if (status) status.textContent = "Saving follow-up...";
    try {
      const followUpRef = push(ref(database, `queries/${queryId}/followUps`));
      await set(followUpRef, {
        date,
        comment,
        user: localStorage.getItem("username") || "Unknown user",
        userId: localStorage.getItem("uid") || "",
        companyId: localStorage.getItem("companyid") || "",
        userRole: localStorage.getItem("role") || "",
        timestamp: serverTimestamp(),
      });
      const snapshot = await get(ref(database, `queries/${queryId}/followUps`));
      renderFollowUpHistory(snapshot.val());
      document.getElementById("follow-up-comment").value = "";
      if (status) status.textContent = "Follow-up saved.";
    } catch (error) {
      console.error("Unable to save query follow-up:", error);
      if (status)
        status.textContent = `Unable to save follow-up: ${error.message}`;
      else if (history)
        history.textContent = `Unable to save follow-up: ${error.message}`;
    } finally {
      saveButton.disabled = false;
    }
  });

// Global Variable[cite: 3]
window.currentStatusFilter = "All";

// Filter Button Click Function[cite: 3]
window.filterByStatus = function (status) {
  window.currentStatusFilter = status;
  console.log("Filter set to:", status);
  window.searchQueries(); // Search ko dobara call karein
};

window.searchQueries = function () {
  const tableBody = document.getElementById("queryTableBody");
  if (!tableBody) return;

  // --- Inputs se values lein (with Safety Check) ---
  const sName = (
    document.getElementById("filter_name")?.value || ""
  ).toLowerCase();
  const sMobile = document.getElementById("filter_mobile")?.value || "";
  const sWhatsapp = document.getElementById("filter_whatsapp")?.value || "";
  const sQueryNumber = (
    document.getElementById("filter_query_number")?.value || ""
  )
    .trim()
    .toUpperCase();

  // NAYE FILTERS: Dropdowns safe extraction taake crash na ho
  const userDropdown = document.getElementById("filter_user_dropdown");
  const sUser = userDropdown ? userDropdown.value : "All Users";

  const forwardedDropdown = document.getElementById(
    "filter_forwarded_dropdown",
  );
  const sForwarded = forwardedDropdown ? forwardedDropdown.value : "All Users";

  tableBody.innerHTML =
    '<tr><td colspan="15" style="text-align:center;">Filtering...</td></tr>';

  const queriesRef = ref(database, "queries");
  get(queriesRef)
    .then((snapshot) => {
      tableBody.innerHTML = "";
      const data = snapshot.val();

      if (!data) {
        updateButtonCounts(0, 0, 0, 0);
        tableBody.innerHTML =
          '<tr><td colspan="15" style="text-align:center;">No data found.</td></tr>';
        return;
      }

      if (Object.values(data).some((query) => !query.queryNumber)) {
        tableBody.innerHTML =
          '<tr><td colspan="15" style="text-align:center;">Assigning query numbers...</td></tr>';
        assignMissingQueryNumbers(data)
          .then(() => window.searchQueries())
          .catch((error) => {
            console.error("Query number assignment failed:", error);
            tableBody.innerHTML =
              '<tr><td colspan="15" style="color:red; text-align:center;">Unable to assign query numbers.</td></tr>';
          });
        return;
      }

      let cDone = 0,
        cProcessing = 0,
        cActive = 0,
        cAll = 0;

      Object.keys(data).forEach((key) => {
        const q = data[key];
        const qStatus = q.status || "Active";

        // 1. Status Counts (Pure database ka total count)
        cAll++;
        if (qStatus.toLowerCase() === "done") cDone++;
        else if (qStatus.toLowerCase() === "processing") cProcessing++;
        else if (qStatus.toLowerCase() === "active") cActive++;

        // 2. Safe Filtering Logic
        const matchesName = (q.name || "").toLowerCase().includes(sName);
        const matchesMobile = (q.mobile || "").includes(sMobile);
        const matchesWhatsapp = (q.whatsapp || "").includes(sWhatsapp);
        const matchesQueryNumber = (q.queryNumber || "")
          .toUpperCase()
          .includes(sQueryNumber);

        const matchesStatus =
          window.currentStatusFilter === "All" ||
          qStatus.toLowerCase() === window.currentStatusFilter.toLowerCase();

        const matchesUser = sUser === "All Users" || q.assignedBy === sUser;
        const matchesForwarded =
          sForwarded === "All Users" || q.forwardedTo === sForwarded;

        // Agar saari conditions match karein to row dikhayein
        if (
          matchesName &&
          matchesQueryNumber &&
          matchesMobile &&
          matchesWhatsapp &&
          matchesStatus &&
          matchesUser &&
          matchesForwarded
        ) {
          const row = document.createElement("tr");
          row.dataset.queryId = key;
          const queryNumberCell = row.insertCell();
          const queryNumber = document.createElement("strong");
          queryNumber.textContent = q.queryNumber || "-";
          queryNumberCell.appendChild(queryNumber);

          const updateCell = row.insertCell();
          const updateButton = document.createElement("button");
          updateButton.className = "btn-update";
          updateButton.type = "button";
          updateButton.textContent = "UPDATE";
          updateButton.addEventListener("click", () =>
            window.manualUpdateStatus(key, updateButton),
          );
          updateCell.appendChild(updateButton);

          const statusCell = row.insertCell();
          const statusDropdown = document.createElement("select");
          statusDropdown.className = "status-dropdown";
          ["Active", "Processing", "Done"].forEach((status) => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status.toUpperCase();
            option.selected = qStatus === status;
            statusDropdown.add(option);
          });
          if (["Active", "Processing", "Done"].includes(qStatus)) {
            statusDropdown.classList.add(qStatus.toLowerCase());
          }
          statusCell.appendChild(statusDropdown);

          [q.date, q.source, q.type].forEach((value) => {
            row.insertCell().textContent = value || "-";
          });
          const nameCell = row.insertCell();
          const name = document.createElement("strong");
          name.textContent = q.name || "-";
          nameCell.appendChild(name);
          [q.mobile, q.whatsapp, q.email].forEach((value) => {
            row.insertCell().textContent = value || "-";
          });
          const descriptionCell = row.insertCell();
          const description = document.createElement("div");
          description.className = "remark-cell";
          description.textContent = q.description || "-";
          descriptionCell.appendChild(description);
          [q.forwardedTo, q.assignedBy].forEach((value) => {
            row.insertCell().textContent = value || "-";
          });

          const followUpCell = row.insertCell();
          const followUpLink = document.createElement("a");
          followUpLink.target = "_blank";
          followUpLink.className = "btn btn-default btn-xs follow-up-link";
          const followUpUrl = new URL(
            "query_follow_up.html",
            window.location.href,
          );
          followUpUrl.searchParams.set("queryId", key);
          followUpLink.href = followUpUrl.href;
          followUpLink.setAttribute(
            "aria-label",
            `Open follow-up for ${q.queryNumber || q.name || "query"}`,
          );
          followUpLink.title = "Follow-up";
          followUpLink.addEventListener("click", (event) => {
            event.preventDefault();
            window.openWindow(followUpLink.href, followUpLink.target);
          });
          const followUpIcon = document.createElement("i");
          followUpIcon.className = "fa fa-calendar-check";
          followUpIcon.setAttribute("aria-hidden", "true");
          followUpLink.appendChild(followUpIcon);
          followUpCell.appendChild(followUpLink);

          const invoiceCell = row.insertCell();
          const invoiceIcon = document.createElement("i");
          invoiceIcon.className = "fa fa-file-invoice";
          invoiceCell.appendChild(invoiceIcon);
          tableBody.appendChild(row);
        }
      });

      // 3. UI Update (Top Buttons par numbers show karne ke liye)
      updateButtonCounts(cDone, cProcessing, cActive, cAll);

      // Agar filter lagane ke baad koi record na bache
      if (!tableBody.rows.length) {
        tableBody.innerHTML =
          '<tr><td colspan="15" style="text-align:center;">No matching queries found.</td></tr>';
      }
    })
    .catch((err) => {
      console.error("Firebase Error Details:", err);
      tableBody.innerHTML =
        '<tr><td colspan="15" style="color:red; text-align:center;">Error loading data. Check Console!</td></tr>';
    });
};

// Buttons ko update karne ka asaan function
function updateButtonCounts(done, proc, active, all) {
  if (document.getElementById("btn-done"))
    document.getElementById("btn-done").innerText = `II Done(${done})`;
  if (document.getElementById("btn-processing"))
    document.getElementById("btn-processing").innerText =
      `▲ Processing(${proc})`;
  if (document.getElementById("btn-active"))
    document.getElementById("btn-active").innerText = `👍 Active(${active})`;
  if (document.getElementById("btn-all"))
    document.getElementById("btn-all").innerText = `Ξ ALL(${all})`;
}

if (window.location.pathname.includes("query_inquiry.html")) {
  document.addEventListener("DOMContentLoaded", () => {
    window.searchQueries(); // Window version call karein[cite: 3]
  });
}

// Firebase connection status check karne ke liye
const connectedRef = ref(database, ".info/connected");

onValue(connectedRef, (snap) => {
  if (snap.val() === true) {
    // Jab connection wapis aaye, tabhi data fetch karein
    if (typeof window.searchQueries === "function") {
      window.searchQueries();
    }
  } else {
    const tableBody = document.getElementById("queryTableBody");
    if (tableBody && tableBody.innerHTML === "") {
      tableBody.innerHTML =
        '<tr><td colspan="15" style="text-align:center;">Reconnecting to server...</td></tr>';
    }
  }
});

function updateQueryStatus(queryId, newStatus) {
  ref(database, "queries/" + queryId)
    .update({
      status: newStatus,
    })
    .then(() => {
      console.log("Status updated to: " + newStatus);
      searchQueries(); // Status change hote hi list refresh ho jaye
    })
    .catch((err) => alert("Error updating status: " + err.message));
}

// Function ko window object ke sath attach karein taake HTML ise access kar sake
window.manualUpdateStatus = function (queryId, btn) {
  // 1. Button ke zariye row aur dropdown dhundna
  const row = btn.closest("tr");
  const dropdown = row.querySelector(".status-dropdown");

  if (!dropdown) {
    console.error("Status dropdown not found in the row!");
    return;
  }

  const newStatus = dropdown.value;

  // 2. Visual feedback (Button disable karna)
  const originalText = btn.innerText;
  btn.innerText = "Saving...";
  btn.disabled = true;

  // 3. Firebase Update (Modular v9+ Syntax)
  // 'update' aur 'ref' aapne file ke top par import kiye hue hain
  update(ref(database, "queries/" + queryId), {
    status: newStatus,
  })
    .then(() => {
      alert("Status Updated to: " + newStatus);
      btn.innerText = originalText;
      btn.disabled = false;

      // Agar aap chahte hain ke update ke baad list refresh ho:
      if (typeof window.searchQueries === "function") {
        window.searchQueries();
      }
    })
    .catch((err) => {
      alert("Error updating status: " + err.message);
      btn.innerText = originalText;
      btn.disabled = false;
    });
};

// Click event listener for the entire table body
// Ismein 'if' condition lagayi hai taake error na aaye
document.addEventListener("click", function (e) {
  const tableBody = document.getElementById("queryTableBody");

  // Agar page par table nahi hai, to ye code aage nahi chalega
  if (!tableBody) return;

  // Check if the clicked element is our Update button
  if (e.target && e.target.classList.contains("btn-manual-save")) {
    const row = e.target.closest("tr");
    const queryId = row.getAttribute("data-key");
    const newStatus = row.querySelector(".status-dropdown").value;

    // Visual feedback
    const btn = e.target;
    const originalText = btn.innerText;
    btn.innerText = "SAVING...";
    btn.disabled = true;

    ref(database, "queries/" + queryId)
      .update({
        status: newStatus,
      })
      .then(() => {
        alert("Updated Successfully!");
        btn.innerText = originalText;
        btn.disabled = false;
        // List refresh karein
        if (typeof searchQueries === "function") searchQueries();
      })
      .catch((err) => {
        alert("Error: " + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
      });
  }
});

window.toggleAccordion = function (id) {
  const element = document.getElementById(id);
  if (!element) return;

  const isOpen = getComputedStyle(element).display !== "none";
  element.style.display = isOpen ? "none" : "block";

  const icon = element.previousElementSibling?.querySelector("i");
  if (!icon) return;
  if (isOpen) {
    icon.classList.replace("fa-caret-down", "fa-caret-right");
  } else {
    icon.classList.replace("fa-caret-right", "fa-caret-down");
  }
};

window.filterVisaCategory = function (category) {
  const normalize = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const filter = normalize(category);
  const matches = (text) => {
    if (filter === "file process") return true;
    if (filter === "done base visit") return normalize(text).includes("visit");
    return normalize(text).includes(filter);
  };

  let hasVisibleEntry = false;
  document.querySelectorAll(".visa-type").forEach((visaType) => {
    const visible = matches(visaType.querySelector("h4")?.textContent || "");
    visaType.hidden = !visible;
    if (visible) hasVisibleEntry = true;
  });

  document.querySelectorAll(".accordion-item").forEach((item) => {
    const hasVisibleVisaType = [...item.querySelectorAll(".visa-type")].some(
      (visaType) => !visaType.hidden,
    );
    item.hidden = !hasVisibleVisaType;
  });

  document.querySelectorAll("#visaTableBody tr").forEach((row) => {
    const visible = matches(row.cells[0]?.textContent || "");
    row.hidden = !visible;
    if (visible) hasVisibleEntry = true;
  });

  const emptyMessage = document.querySelector(".visa-category-empty");
  if (emptyMessage) emptyMessage.hidden = hasVisibleEntry;
};

document.querySelectorAll(".visa-category-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".visa-category-tab").forEach((tab) => {
      const isActive = tab === button;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-pressed", String(isActive));
    });
    window.filterVisaCategory(button.dataset.visaCategory || "FILE PROCESS");
  });
});

const tableBody = document.getElementById("visaTableBody");

if (tableBody) {
  // Data fetch karna aur list mein dikhana
  const q = query(collection(db, "visas"), orderBy("createdAt", "asc"));

  // ... Firebase init code ...

  onSnapshot(q, (snapshot) => {
    tableBody.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const id = doc.id;

      // Same to same row structure with icons
      const row = `
                <tr>
                    <td>${data.name.toUpperCase()}</td>
                    <td class="icon-col">
                        <a href="#" onclick="editVisa('${id}')">
                            <img src="edit_icon.png" width="16" alt="Edit"> 
                        </a>
                    </td>
                    <td class="icon-col">
                        <a href="#" onclick="deleteVisa('${id}')">
                            <img src="delete_icon.png" width="16" alt="Delete">
                        </a>
                    </td>
                </tr>`;
      tableBody.innerHTML += row;
    });
    const selectedCategory = document.querySelector(".visa-category-tab.active")
      ?.dataset.visaCategory;
    if (selectedCategory) window.filterVisaCategory(selectedCategory);
  });
}

// Server se users fetch karke dropdowns mein bharne ka function
window.loadUsersIntoDropdowns = function () {
  const userDropdown = document.getElementById("filter_user_dropdown");
  if (!userDropdown) return;

  const usersRef = ref(database, "users");
  get(usersRef)
    .then((snapshot) => {
      const allData = snapshot.val();
      if (!allData) return;

      // Dropdown clear karein (siwaye "All Users" ke)
      userDropdown.innerHTML = '<option value="All Users">All Users</option>';

      const groups = ["admins", "workers"];
      groups.forEach((group) => {
        if (allData[group]) {
          Object.keys(allData[group]).forEach((key) => {
            const user = allData[group][key];
            const userName = user.username;

            // Option element banayein
            const option = `<option value="${userName}">${userName}</option>`;
            userDropdown.innerHTML += option;
          });
        }
      });
    })
    .catch((err) => console.error("Error loading users:", err));
};

window.saveBookingToFirebase = function () {
  // 1. Pax Details Section
  const title = document.getElementById("pax_title")?.value || "";
  const surname = document.getElementById("pax_surname")?.value.trim() || "";
  const givenName =
    document.getElementById("pax_givenname")?.value.trim() || "";
  const fatherName = document.getElementById("pax_fh_name")?.value.trim() || "";
  const contactNo = document.getElementById("pax_contact")?.value.trim() || "";
  const whatsappNo =
    document.getElementById("pax_whatsapp_no")?.value.trim() || "";
  const passportNo = document.getElementById("pax_pp_no")?.value.trim() || "";
  const dob = document.getElementById("pax_dob")?.value || "";
  const ppExpire = document.getElementById("pax_pp_expire")?.value || "";
  const city = document.getElementById("searchCity")?.value || "";
  const country = document.getElementById("searchCountry")?.value || "";
  const agent = document.getElementById("searchAgent")?.value || "";
  const datetime = document.getElementById("pax_datetime")?.value || "";
  const ticketno = document.getElementById("pax_ticket_no")?.value || "";
  // 2. Airline & Fare Detail Section
  const route = document.getElementById("airline_route")?.value.trim() || "";
  const carrier = document.getElementById("airline_carrier")?.value || "";
  const pnr = document.getElementById("airline_pnr")?.value.trim() || "";
  const gdsPnr = document.getElementById("airline_gds_pnr")?.value.trim() || "";
  const fare = document.getElementById("airline_fare")?.value || "0";
  const taxes = document.getElementById("airline_taxes")?.value || "0";
  const totalFare = document.getElementById("airline_total_fare")?.value || "0";
  const salePrice = document.getElementById("airline_sale")?.value || "0";
  const remarks = document.getElementById("airline_remarks")?.value || "";

  // Validation
  if (surname === "" || contactNo === "") {
    alert("Error: Please fill Surname and Contact Number!");
    return;
  }

  // 3. Complete Data Object
  const bookingData = {
    transNo: "TEMP" + Date.now().toString().slice(-5),
    title: title,
    surname: surname,
    givenName: givenName,
    fatherName: fatherName,
    contactNo: contactNo,
    customerContactKey:
      document.getElementById("invoice_family_head")?.dataset.contactKey || "",
    whatsappNo: whatsappNo,
    passportNo: passportNo,
    dob: dob,
    ppExpire: ppExpire,
    city: city,
    country: country,
    agent: agent,
    datetime: datetime,
    ticketno: ticketno,
    // Airline details
    route: route,
    carrier: carrier,
    pnr: pnr,
    gdsPnr: gdsPnr,
    fare: fare,
    taxes: taxes,
    totalFare: totalFare,
    salePrice: salePrice,
    remarks: remarks,
    // Meta data
    addedBy: localStorage.getItem("username") || "Admin",
    timestamp: serverTimestamp(), //[cite: 3]
  };

  const bookingsRef = ref(database, "bookings");

  push(bookingsRef, bookingData)
    .then(() => {
      alert("Full Booking Saved Successfully!");
      window.location.href = "temporary_booking.html"; //[cite: 10]
    })
    .catch((err) => {
      alert("Firebase Error: " + err.message);
    });
};

// ==========================================
// --- TICKETING DATA FETCH FUNCTION ---
// ==========================================
window.fetchTicketingData = function () {
  const tableBody = document.getElementById("tempBookingData");
  if (!tableBody) return;

  const renderMessage = (message, color) => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 16;
    cell.style.textAlign = "center";
    if (color) cell.style.color = color;
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.replaceChildren(row);
  };

  renderMessage("Searching data on server...");

  const bookingsRef = ref(database, "bookings");

  // 'get' use karne se data sirf ek baar fetch hoga jab click karenge
  get(bookingsRef)
    .then((snapshot) => {
      const data = snapshot.val();

      if (!data) {
        renderMessage("No records found.");
        return;
      }

      const rows = Object.entries(data).map(([key, bookingRecord], index) => {
        const booking =
          bookingRecord && typeof bookingRecord === "object"
            ? bookingRecord
            : {};
        const row = document.createElement("tr");
        const addCell = (value, options = {}) => {
          const cell = document.createElement("td");
          if (options.align) cell.style.textAlign = options.align;
          if (options.fontSize) cell.style.fontSize = options.fontSize;
          if (options.strong) {
            const strong = document.createElement("strong");
            strong.textContent = String(value);
            cell.appendChild(strong);
          } else {
            cell.textContent = String(value);
          }
          row.appendChild(cell);
        };

        addCell(index + 1);
        addCell(
          `${booking.title || ""} ${booking.surname || "-"} ${booking.givenName || ""}`,
          { strong: true },
        );
        addCell(booking.contactNo || "-");
        addCell(booking.whatsappNo || "-");
        addCell(booking.pnr || "-");
        addCell(booking.gdsPnr || "-");
        addCell(booking.fare || "0", { align: "right" });
        addCell(booking.taxes || "0", { align: "right" });
        addCell(booking.totalFare || "0", { align: "right" });
        addCell(booking.salePrice || "0", { align: "right" });
        addCell(booking.carrier || "-");

        const timestamp = Number(booking.timestamp);
        addCell(
          Number.isFinite(timestamp) && timestamp > 0
            ? new Date(timestamp).toLocaleString()
            : "-",
          { fontSize: "11px" },
        );
        addCell(booking.addedBy || "-");
        addCell("", { align: "center" });
        const confirmationCheckbox = document.createElement("input");
        confirmationCheckbox.type = "checkbox";
        confirmationCheckbox.checked = true;
        confirmationCheckbox.disabled = true;
        row.cells[row.cells.length - 1].appendChild(confirmationCheckbox);

        const passportCell = document.createElement("td");
        passportCell.style.textAlign = "center";
        const passengerIcon = document.createElement("i");
        passengerIcon.className = "fa fa-users";
        passengerIcon.title = `PP: ${booking.passportNo || "N/A"}`;
        passportCell.appendChild(passengerIcon);
        row.appendChild(passportCell);

        const actionsCell = document.createElement("td");
        actionsCell.style.textAlign = "center";
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "action-btn edit-btn";
        editButton.setAttribute("aria-label", "Edit booking");
        const editIcon = document.createElement("i");
        editIcon.className = "fas fa-edit";
        editIcon.style.color = "#007bff";
        editButton.appendChild(editIcon);
        editButton.addEventListener("click", () => window.editBooking(key));
        actionsCell.appendChild(editButton);
        row.appendChild(actionsCell);

        return row;
      });

      const rowsFragment = document.createDocumentFragment();
      rows.forEach((row) => rowsFragment.appendChild(row));
      tableBody.replaceChildren(rowsFragment);
    })
    .catch((error) => {
      console.error("Search Error:", error);
      renderMessage(`Error: ${error.message}`, "red");
    });
};

// --- EDIT FUNCTION (ReferenceError fix karne ke liye) ---
window.editBooking = function (key) {
  console.log("Editing booking key:", key);
  alert(
    "Editing feature for ID: " + key + " is active. Logic can be added here.",
  );
  // Example: window.location.href = `edit_booking.html?id=${key}`;
};

async function loadSelectedSupplierBalance(vendorKey, vendor) {
  const balanceElement = document.querySelector(".supplier-box .credit-val");
  if (!balanceElement) return;
  if (!vendorKey || !vendor) {
    balanceElement.textContent = "0.00";
    return;
  }

  balanceElement.textContent = "Loading...";
  try {
    const [
      bookingsSnapshot,
      cashReceiptsSnapshot,
      cashPaymentsSnapshot,
      bankReceiptsSnapshot,
      bankPaymentsSnapshot,
    ] = await Promise.all([
      getDatabaseSnapshot("bookings"),
      getDatabaseSnapshot("cashReceipts"),
      getDatabaseSnapshot("cashPayments"),
      getDatabaseSnapshot("bankReceipts"),
      getDatabaseSnapshot("bankPayments"),
    ]);
    const parseAmount = (value) => {
      const amount = Number.parseFloat(
        String(value || "0")
          .replace(/,/g, "")
          .trim(),
      );
      return Number.isFinite(amount) ? amount : 0;
    };
    const normalizeReference = (value) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const vendorReferences = new Set(
      [
        vendorKey,
        vendor.legacyVendorKey,
        vendor.fullName,
        vendor.contactNo,
        vendor.contactNumber,
      ]
        .filter(Boolean)
        .map(normalizeReference),
    );
    const matchesVendorReference = (value) =>
      vendorReferences.has(normalizeReference(value));
    let balance = 0;

    Object.values(bookingsSnapshot.val() || {}).forEach((booking) => {
      const bookingVendor =
        booking.supplierContactKey ||
        booking.supplierKey ||
        booking.vendorKey ||
        booking.supplier ||
        booking.vendor ||
        booking.agent;
      if (!matchesVendorReference(bookingVendor)) return;

      const totalFare = Number.parseFloat(
        String(booking.totalFare || "")
          .replace(/,/g, "")
          .trim(),
      );
      const fare = parseAmount(booking.fare);
      const taxes = parseAmount(booking.taxes);
      balance += Number.isFinite(totalFare) ? totalFare : fare + taxes;
    });

    [cashPaymentsSnapshot, bankPaymentsSnapshot].forEach((snapshot) => {
      Object.values(snapshot.val() || {}).forEach((payment) => {
        if (
          payment.customerContactKey === vendorKey ||
          matchesVendorReference(payment.from)
        ) {
          balance -= parseAmount(payment.amount);
        }
      });
    });
    [cashReceiptsSnapshot, bankReceiptsSnapshot].forEach((snapshot) => {
      Object.values(snapshot.val() || {}).forEach((receipt) => {
        if (
          receipt.customerContactKey === vendorKey ||
          matchesVendorReference(receipt.into)
        ) {
          balance -= parseAmount(receipt.amount);
        }
      });
    });

    const supplierSelect = document.getElementById("supplier_select");
    if (supplierSelect?.value !== vendorKey) return;
    const sign = balance > 0 ? "+" : balance < 0 ? "-" : "";
    balanceElement.textContent = `${sign}${Math.abs(balance).toLocaleString(
      undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    )}`;
  } catch (error) {
    console.error("Error loading selected supplier balance:", error);
    const supplierSelect = document.getElementById("supplier_select");
    if (supplierSelect?.value === vendorKey) {
      balanceElement.textContent = "Unable to load";
    }
  }
}

window.loadSupplierVendors = function () {
  const supplierSelect = document.getElementById("supplier_select");
  if (!supplierSelect) return;
  const vendorsByKey = new Map();

  supplierSelect.addEventListener("change", () => {
    const vendorKey = supplierSelect.value;
    if (!vendorKey) {
      const balanceElement = document.querySelector(
        ".supplier-box .credit-val",
      );
      if (balanceElement) balanceElement.textContent = "0.00";
      return;
    }
    loadSelectedSupplierBalance(vendorKey, vendorsByKey.get(vendorKey));
  });

  getDatabaseSnapshot("contacts")
    .then((snapshot) => {
      const vendors = Object.entries(snapshot.val() || {}).filter(
        ([, contact]) =>
          contact &&
          String(contact.accountCategory || "")
            .trim()
            .toLowerCase() === "new vendor",
      );
      vendorsByKey.clear();
      vendors.forEach(([key, vendor]) => vendorsByKey.set(key, vendor));
      supplierSelect.innerHTML = '<option value="">Select Supplier</option>';
      vendors.forEach(([key, vendor]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent =
          [vendor.fullName, vendor.contactNo].filter(Boolean).join(" - ") ||
          "Unnamed Vendor";
        supplierSelect.appendChild(option);
      });
      if (!vendors.length) {
        supplierSelect.innerHTML = '<option value="">No vendors found</option>';
      }
      if (supplierSelect.value) {
        loadSelectedSupplierBalance(
          supplierSelect.value,
          vendorsByKey.get(supplierSelect.value),
        );
      }
    })
    .catch((error) => {
      console.error("Supplier vendor load error:", error);
      supplierSelect.innerHTML =
        '<option value="">Unable to load vendors</option>';
    });
};

document.addEventListener("DOMContentLoaded", () => {
  window.loadSupplierVendors();
});

window.drawOnCanvas = function () {
  const canvas = document.getElementById("packageCanvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.src = "image_c9794b.jpg"; // Apni main image file ka naam

  img.onload = function () {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = "#000000"; // Text color
    ctx.font = "bold 60px Arial";

    // 1. DAYS WALA BOX (X=200, Y=300)
    const days = document.getElementById("editDays").value;
    const daysX = 200; // Yahan se X change karein
    const daysY = 300; // Yahan se Y change karein
    ctx.fillText(days + " Days", daysX, daysY);

    // 2. CITY/SIALKOT WALA BOX (X=600, Y=300)
    // Maine X=600 rakha hai taake ye Days ke aage ho
    const city = document.getElementById("editCity").value;
    const cityX = 600; // Yahan se X change karein (Right/Left shift ke liye)
    const cityY = 300; // Yahan se Y change karein (Upar/Niche ke liye)
    ctx.fillText("From: " + city, cityX, cityY);

    // Download button enable karein
    const btn = document.getElementById("downloadBtn");
    btn.style.display = "block";
    btn.href = canvas.toDataURL("image/png");
  };
};
