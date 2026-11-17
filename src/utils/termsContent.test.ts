import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPORTANT_NOTICE_BULLETS_BN,
  PRIVACY_POLICY_SECTIONS,
  TERMS_HIGHLIGHT_BULLETS_BN,
  TERMS_OF_SERVICE_SECTIONS,
  validateSignupTermsAcceptance,
} from './termsContent.ts';

test('includes all 9 Terms sections, 8 Privacy sections, and important notice bullets without placeholders', () => {
  assert.equal(TERMS_HIGHLIGHT_BULLETS_BN.length, 3);
  assert.equal(TERMS_OF_SERVICE_SECTIONS.length, 9);
  assert.equal(PRIVACY_POLICY_SECTIONS.length, 8);
  assert.equal(IMPORTANT_NOTICE_BULLETS_BN.length, 3);

  const serialized = JSON.stringify({
    TERMS_HIGHLIGHT_BULLETS_BN,
    TERMS_OF_SERVICE_SECTIONS,
    PRIVACY_POLICY_SECTIONS,
    IMPORTANT_NOTICE_BULLETS_BN,
  });

  assert.equal(serialized.includes('[তারিখ'), false);
  assert.equal(serialized.includes('[আপনার'), false);
  assert.equal(serialized.includes('আমার স্যালারি ক্যালকুলেটর'), false);
  assert.equal(serialized.includes('শ্রমিক সাথী'), true);
});

test('validateSignupTermsAcceptance enforces checkbox tick only during signup', () => {
  assert.equal(validateSignupTermsAcceptance('signin', false, 'bn'), null);
  assert.equal(validateSignupTermsAcceptance('signin', true, 'bn'), null);
  assert.equal(validateSignupTermsAcceptance('signup', true, 'bn'), null);

  const bnErr = validateSignupTermsAcceptance('signup', false, 'bn');
  assert.ok(bnErr && bnErr.includes('শর্তাবলী'));

  const enErr = validateSignupTermsAcceptance('signup', false, 'en');
  assert.ok(enErr && enErr.includes('Terms & Conditions'));
});
