import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareChannelUrls,
  buildSharePayload,
  getShareAppUrl,
} from './shareApp';

test('getShareAppUrl trims trailing slashes and preserves clean origin', () => {
  assert.equal(
    getShareAppUrl('https://shromik-sathi.web.app///'),
    'https://shromik-sathi.web.app'
  );
  assert.equal(
    getShareAppUrl('https://example.com'),
    'https://example.com'
  );
});

test('buildSharePayload builds localized Bengali and English payloads with clean URL', () => {
  const bn = buildSharePayload('bn', 'https://shromik-sathi.web.app/');
  assert.equal(bn.title, 'শ্রমিক সাথী');
  assert.equal(bn.url, 'https://shromik-sathi.web.app');
  assert.ok(bn.fullMessage.includes(bn.url));

  const en = buildSharePayload('en', 'https://shromik-sathi.web.app/');
  assert.equal(en.title, 'Shromik Sathi');
  assert.equal(en.url, 'https://shromik-sathi.web.app');
  assert.ok(en.fullMessage.includes(en.url));
});

test('buildShareChannelUrls produces valid encoded WhatsApp, Facebook, Telegram, and SMS URLs', () => {
  const payload = buildSharePayload('bn', 'https://shromik-sathi.web.app');
  const channels = buildShareChannelUrls(payload);

  assert.ok(channels.whatsapp.startsWith('https://wa.me/?text='));
  assert.ok(
    channels.whatsapp.includes(encodeURIComponent('https://shromik-sathi.web.app'))
  );
  assert.equal(
    channels.facebook,
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      'https://shromik-sathi.web.app'
    )}`
  );
  assert.ok(channels.telegram.startsWith('https://t.me/share/url?url='));
  assert.ok(channels.sms.startsWith('sms:?body='));
});
