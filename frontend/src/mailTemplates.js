export const MAIL_TEMPLATES = [
  {
    id: 'intro',
    name: 'Introduction',
    hint: 'First outreach to a new lead',
    subject: 'Introducing SaarthiX for {{company}}',
    body: `Dear {{name}},

I hope you are doing well. I am {{sender}} from SaarthiX, and I wanted to introduce how we help institutions like {{company}} with campus placements and student career readiness.

Would you have 15 minutes this week for a short conversation?

Warm regards,
{{sender}}
SaarthiX`,
  },
  {
    id: 'followup',
    name: 'Follow-up',
    hint: 'After a call or earlier email',
    subject: 'Following up — SaarthiX and {{company}}',
    body: `Dear {{name}},

Thank you for your time earlier. I wanted to follow up on our discussion about SaarthiX for {{company}}.

Please let me know a convenient slot if you would like to continue, or if I should share a short overview with your team.

Best regards,
{{sender}}
SaarthiX`,
  },
  {
    id: 'demo',
    name: 'Demo invite',
    hint: 'Invite them to a product demo',
    subject: 'SaarthiX demo for {{company}}',
    body: `Dear {{name}},

I would like to schedule a live SaarthiX demo for {{company}}. The session usually takes 20–30 minutes and covers campus workflow, student tracking and reporting.

Please share two or three time slots that work for you this week.

Warm regards,
{{sender}}
SaarthiX`,
  },
  {
    id: 'proposal',
    name: 'Proposal',
    hint: 'Share next steps after interest',
    subject: 'SaarthiX proposal for {{company}}',
    body: `Dear {{name}},

As discussed, I am sharing a brief proposal for how SaarthiX can support {{company}}.

Happy to walk through pricing, onboarding and a pilot timeline whenever you are ready.

Best regards,
{{sender}}
SaarthiX`,
  },
  {
    id: 'meeting',
    name: 'Meeting confirmation',
    hint: 'Confirm a booked meeting',
    subject: 'Confirming our meeting — {{company}}',
    body: `Dear {{name}},

This is to confirm our upcoming meeting regarding SaarthiX for {{company}}. Please reply if you need to reschedule.

Looking forward to speaking with you.

Warm regards,
{{sender}}
SaarthiX`,
  },
  {
    id: 'thanks',
    name: 'Thank you',
    hint: 'After a meeting or campus visit',
    subject: 'Thank you — {{company}} and SaarthiX',
    body: `Dear {{name}},

Thank you for meeting with us. It was good to learn more about {{company}} and how SaarthiX can help.

I will send the agreed next steps shortly. Please reach out if anything else would be useful.

Best regards,
{{sender}}
SaarthiX`,
  },
  {
    id: 'blank',
    name: 'Blank email',
    hint: 'Start with an empty message',
    subject: '',
    body: '',
  },
];

export function fillTemplate(text, vars = {}) {
  return String(text || '')
    .replaceAll('{{name}}', vars.name || 'there')
    .replaceAll('{{company}}', vars.company || 'your institution')
    .replaceAll('{{sender}}', vars.sender || 'the SaarthiX team');
}

export function openOutlook({ to = '', subject = '', body = '' }) {
  const query = [
    subject ? `subject=${encodeURIComponent(subject)}` : '',
    body ? `body=${encodeURIComponent(body)}` : '',
  ].filter(Boolean).join('&');
  const mailto = `mailto:${to}${query ? `?${query}` : ''}`;
  const link = document.createElement('a');
  link.href = mailto;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
