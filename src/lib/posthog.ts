import PostHog from 'posthog-js'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export const posthog =
  typeof window !== 'undefined' && POSTHOG_KEY
    ? PostHog.init(POSTHOG_KEY, {
        api_host: 'https://app.posthog.com',
      })
    : null;
