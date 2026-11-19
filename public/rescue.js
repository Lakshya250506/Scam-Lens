'use strict';

// Rescue Mode content and step ordering. Deterministic and human-reviewed:
// nothing here calls an AI provider. Loaded by the browser as /rescue.js
// (window.ScamLensRescue) and imported directly by Node tests.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.ScamLensRescue = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {

const RESCUE_LABELS = {
    money: 'Money transferred or unauthorised debit',
    credentials: 'OTP, password, PIN or card details shared',
    app: 'Suspicious app installed or remote access allowed',
    arrest: 'Threatened with digital arrest'
};

const STEPS = {
    endCall: [
        'End the threatening call and stop following instructions',
        'Do not transfer money, share information, install an app or remain on a video call because of threats. Do not pay to “settle” a case. Scammers pose as police, CBI, anti-narcotics or RBI officers, and government agencies do not conduct investigations over phone or video calls. Speak to someone you trust. You can report the attempt on 1930 or at cybercrime.gov.in.'
    ],
    bank: [
        'Contact your bank or payment provider immediately',
        'If there is an unauthorised transaction, notify your bank immediately and get an acknowledgement from the bank. Delays in reporting may increase your loss. This does not guarantee that lost money can be returned. General safety advice (not from RBI): use the official number on your bank card, in its official app or on a website you type yourself. Explain what was shared or transferred and ask the bank to secure the affected account, card, UPI ID or payment method. Note the complaint/reference number. If your phone may be compromised, call from a different trusted device.'
    ],
    helpline: [
        'Report financial cyber fraud through 1930',
        'If money has moved without your permission or you were tricked into sending it, call India’s cyber financial fraud helpline 1930 as soon as possible. Keep the transaction date, amount, bank/wallet name and transaction reference ready. Do not delay contacting your bank.'
    ],
    portal: [
        'Submit a report on the National Cyber Crime Reporting Portal',
        'Report the financial cyber fraud, impersonation or threat at cybercrime.gov.in. Save the acknowledgement/reference number and follow the portal’s instructions.'
    ],
    disconnect: [
        'Disconnect the possibly compromised phone',
        'Turn off Wi-Fi and mobile data on the phone where the suspicious app was installed or remote access was enabled. General safety advice: do not use that phone for banking or password changes, and use a different trusted device for calls and account recovery.'
    ],
    secure: [
        'Secure credentials that may have been exposed',
        'From a clean, trusted device, change affected account passwords using official apps or websites. Follow your bank’s instructions to change exposed payment credentials, block affected cards or payment methods, and sign out unknown sessions. Never share a new OTP or PIN with anyone.'
    ],
    device: [
        'Check and clean the affected device',
        'Uninstall suspicious applications and run antivirus software on the device. General safety advice: keep the device disconnected while you assess it, get help from a trusted service professional if needed, do not grant the app further permissions, and change exposed credentials only from a clean device.'
    ],
    verify: [
        'Verify the claimed authority independently',
        'There is no concept of “Digital Arrest” under Indian law. Scammers impersonate government and law-enforcement officials. Contact your nearest police station yourself to verify the claimed authority, using contact details you find independently and not a number or link supplied by the caller. Do not share personal or financial information before you have verified.'
    ],
    emergency112: [
        'If you feel physically unsafe, call 112',
        'If someone is threatening to harm you or you are in immediate physical danger, move to a safe place and call 112, India’s emergency number. 112 is for immediate danger; for money lost to fraud, use 1930.'
    ],
    report: [
        'Report the impersonation or extortion attempt',
        'Report the threatening or impersonation attempt through cybercrime.gov.in or your nearest police station. If money was transferred, also select “Money sent or taken” so the financial-fraud steps appear.'
    ],
    monitor: [
        'Check accounts and recent activity',
        'Review bank, card, UPI and wallet activity for unfamiliar transactions. Report any new unauthorised transaction to the relevant provider immediately and keep the complaint reference.'
    ],
    preserve: [
        'Preserve the evidence',
        'Keep screenshots, messages, call logs, phone numbers, email addresses, URLs, app names, payment handles, transaction references and approximate times. Do not delete the original conversation before preserving what happened.'
    ]
};

const SCENARIO_STEPS = {
    money: ['bank', 'helpline', 'portal', 'monitor', 'preserve'],
    credentials: ['bank', 'secure', 'monitor', 'preserve'],
    app: ['disconnect', 'bank', 'device', 'secure', 'monitor', 'preserve'],
    arrest: ['endCall', 'emergency112', 'verify', 'report', 'preserve']
};

// Official sources. The static "Official guidance used" list in index.html
// must show the same labels and URLs.
const SOURCE_LIST = {
    i4c: {
        label: 'I4C / NCTAU: Digital Arrest Scam Advisory, 6 March 2025',
        url: 'https://cybercrime.gov.in/pdf/Advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf'
    },
    rbi: {
        label: 'RBI: Reporting unauthorised transactions',
        url: 'https://www.rbi.org.in/commonman/english/Scripts/SMSLimitedliability.aspx'
    },
    certin: {
        label: 'CERT-In: Sophisticated RTO/eChallan-themed Android Malware Advisory, 17 March 2026',
        url: 'https://www.cert-in.org.in/s2cMainServlet?CACODE=CICA-2026-3492&pageid=PUBADV01'
    },
    pib: {
        label: 'PIB (Ministry of Home Affairs): Digital Arrest warning, 27 October 2024',
        url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2068698&lang=2&reg=48'
    }
};

const RESCUE_REVIEWED_DATE = '18 November 2026';

const CERTIN_NOTE = 'This advisory is about a specific Android e-Challan malware campaign. It does not cover every remote-access or screen-sharing incident. Its precautions are: disconnect Wi-Fi and mobile data, uninstall suspicious applications, run antivirus, change passwords and UPI PIN, and check bank statements. Other advice in this step is general safety advice.';

// Where a step's claim comes from. "note" says what the source supports.
const SOURCES = {
    endCall: Object.assign({}, SOURCE_LIST.pib, {
        note: 'Supports: fraudsters pose as police, CBI, anti-narcotics or RBI officers; no government agency conducts investigations by phone or video call; report on 1930 or cybercrime.gov.in.'
    }),
    bank: Object.assign({}, SOURCE_LIST.rbi, {
        note: 'RBI supports: inform the bank immediately, take an acknowledgement, and delay can increase your loss. The rest of this step is general safety advice.'
    }),
    disconnect: Object.assign({}, SOURCE_LIST.certin, { note: CERTIN_NOTE }),
    device: Object.assign({}, SOURCE_LIST.certin, { note: CERTIN_NOTE }),
    verify: Object.assign({}, SOURCE_LIST.i4c, {
        note: 'Supports: there is no concept of Digital Arrest in Indian law, and scammers impersonate officials.'
    })
};

// One global urgency order: contain the threat, protect money, secure
// accounts, then report, verify and preserve evidence. Selection order
// and scenario combination never change the result.
const RESCUE_ORDER = [
    'endCall', 'emergency112', 'disconnect', 'bank', 'helpline', 'secure',
    'device', 'portal', 'verify', 'report', 'monitor', 'preserve'
];

function getRescueSteps(selected) {
    const ids = new Set(
        (selected || []).flatMap(s => SCENARIO_STEPS[s] || [])
    );

    // "portal" and "report" are the same cybercrime.gov.in action.
    if (ids.has('portal')) ids.delete('report');

    return RESCUE_ORDER.filter(id => ids.has(id));
}

return {
    RESCUE_LABELS, STEPS, SCENARIO_STEPS, SOURCES, SOURCE_LIST,
    RESCUE_REVIEWED_DATE, RESCUE_ORDER, getRescueSteps
};
});
