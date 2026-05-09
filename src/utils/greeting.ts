// utils/greeting.ts
// Time-of-day greeting generator.
// Each time bucket has two pools:
//   - `named`: variants that interpolate the user's name, used when name is provided
//   - `anonymous`: variants without a name, used when name is absent
// One variant is picked at random per render.

export type TimeBucket =
    | "earlyMorning" // 04:00 - 06:59
    | "morning"      // 07:00 - 11:59
    | "afternoon"    // 12:00 - 16:59
    | "evening"      // 17:00 - 20:59
    | "night"        // 21:00 - 23:59
    | "lateNight";   // 00:00 - 03:59

export const getTimeBucket = (date: Date = new Date()): TimeBucket => {
    const h = date.getHours();
    if (h >= 4 && h < 7) return "earlyMorning";
    if (h >= 7 && h < 12) return "morning";
    if (h >= 12 && h < 17) return "afternoon";
    if (h >= 17 && h < 21) return "evening";
    if (h >= 21) return "night";
    return "lateNight";
};

type NamedVariant = (name: string) => string;
type AnonymousVariant = () => string;

interface VariantPool {
    named: NamedVariant[];
    anonymous: AnonymousVariant[];
}

// Each bucket has both pools so we can keep neutral lines available even when
// a name is known — but they live in `anonymous` so they don't displace the
// personalized variants when a name is present.
const VARIANTS: Record<TimeBucket, VariantPool> = {
    earlyMorning: {
        named: [
            (n) => `Up early, ${n}`,
            (n) => `Good morning, ${n}`,
        ],
        anonymous: [
            () => "Up early",
            () => "Good morning",
            () => "The day is just beginning",
        ],
    },
    morning: {
        named: [
            (n) => `Good morning, ${n}`,
            (n) => `Hello, ${n}`,
            (n) => `Ready when you are, ${n}`,
            (n) => `What's on your mind, ${n}?`,
        ],
        anonymous: [
            () => "Good morning",
            () => "Hello",
            () => "What's on your mind today?",
        ],
    },
    afternoon: {
        named: [
            (n) => `Good afternoon, ${n}`,
            (n) => `Hi ${n}, what's new?`,
            (n) => `Welcome back, ${n}`,
            (n) => `Where should we begin, ${n}?`,
        ],
        anonymous: [
            () => "Good afternoon",
            () => "What's new?",
            () => "Where should we begin?",
        ],
    },
    evening: {
        named: [
            (n) => `Good evening, ${n}`,
            (n) => `Winding down, ${n}?`,
            (n) => `How was your day, ${n}?`,
        ],
        anonymous: [
            () => "Good evening",
            () => "Winding down?",
            () => "How was your day?",
        ],
    },
    night: {
        named: [
            (n) => `Good evening, ${n}`,
            (n) => `Still going, ${n}?`,
        ],
        anonymous: [
            () => "Good evening",
            () => "Still going?",
            () => "A quiet moment to capture a thought",
        ],
    },
    lateNight: {
        named: [
            (n) => `It's late, ${n}`,
            (n) => `Burning the midnight oil, ${n}?`,
        ],
        anonymous: [
            () => "It's late",
            () => "Burning the midnight oil?",
            () => "The night is yours",
        ],
    },
};

// Pick a greeting for the current time. When `name` is provided, picks from
// the named pool so the result reliably feels personal.
export const pickGreeting = (name?: string): string => {
    const bucket = getTimeBucket();
    const pool = VARIANTS[bucket];

    if (name && pool.named.length > 0) {
        const idx = Math.floor(Math.random() * pool.named.length);
        return pool.named[idx](name);
    }

    const idx = Math.floor(Math.random() * pool.anonymous.length);
    return pool.anonymous[idx]();
};