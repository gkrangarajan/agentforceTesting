import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import NAME_FIELD from '@salesforce/schema/Account.Name';
import BILLING_STREET from '@salesforce/schema/Account.BillingStreet';
import BILLING_CITY from '@salesforce/schema/Account.BillingCity';
import BILLING_STATE from '@salesforce/schema/Account.BillingState';
import BILLING_POSTAL from '@salesforce/schema/Account.BillingPostalCode';
import BILLING_COUNTRY from '@salesforce/schema/Account.BillingCountry';

/**
 * Account Create Form LWC
 * - Creates Account using LDS lightning-record-edit-form
 * - Fields: Name, Email__c (or custom email field via @api), Billing Address
 * - Emits 'accountcreated' with { recordId } on success
 * - Exposes @api recordId for Flow usage
 */
export default class AccountCreateForm extends LightningElement {
  // Allow consumer to override the email field API name if it differs from Email__c
  @api emailField = 'Email__c';

  // Expose created record Id (useful for flows)
  @api recordId;

  // UI state
  @track isSubmitting = false;

  // Address local state
  @track billingStreet = '';
  @track billingCity = '';
  @track billingState = '';
  @track billingPostal = '';
  @track billingCountry = '';

  // Fallback email input value when using non-standard API names
  @track emailValue = '';

  get emailFieldIsStandard() {
    // If Email__c, we can use lightning-input-field directly
    return this.emailField === 'Email__c';
  }

  handleEmailChange(event) {
    this.emailValue = event.target.value || '';
  }

  handleAddressChange(event) {
    const { street, city, province, postalCode, country } = event.detail || {};
    this.billingStreet = street || '';
    this.billingCity = city || '';
    this.billingState = province || '';
    this.billingPostal = postalCode || '';
    this.billingCountry = country || '';
  }

  handleReset() {
    // Clear local state and reset the form
    this.emailValue = '';
    this.billingStreet = '';
    this.billingCity = '';
    this.billingState = '';
    this.billingPostal = '';
    this.billingCountry = '';

    const form = this.template.querySelector('lightning-record-edit-form');
    if (form) {
      // reset() is not available on record-edit-form; reset all fields instead
      const inputFields = this.template.querySelectorAll('lightning-input-field, lightning-input, lightning-input-address');
      inputFields.forEach((field) => {
        if (field.reset) {
          field.reset();
        } else if ('value' in field) {
          // generic fallback
          // eslint-disable-next-line no-param-reassign
          field.value = '';
        }
      });
    }
  }

  handleSubmit(event) {
    // Intercept submit to inject address + dynamic email field if needed
    event.preventDefault();
    this.isSubmitting = true;

    try {
      const fields = event.detail && event.detail.fields ? event.detail.fields : {};

      // Inject Billing Address fields from local state
      fields[BILLING_STREET.fieldApiName] = this.billingStreet;
      fields[BILLING_CITY.fieldApiName] = this.billingCity;
      fields[BILLING_STATE.fieldApiName] = this.billingState;
      fields[BILLING_POSTAL.fieldApiName] = this.billingPostal;
      fields[BILLING_COUNTRY.fieldApiName] = this.billingCountry;

      // Inject Email when email field is not the standard Email__c rendering
      if (!this.emailFieldIsStandard) {
        fields[this.emailField] = this.emailValue || null;
      }

      // Submit back to the form
      this.template.querySelector('lightning-record-edit-form').submit(fields);
    } catch (err) {
      this.isSubmitting = false;
      this.dispatchEvent(
        new ShowToastEvent({
          title: 'Error preparing submission',
          message: this.normalizeError(err),
          variant: 'error'
        })
      );
    }
  }

  handleSuccess(event) {
    this.isSubmitting = false;
    const newId = event.detail && event.detail.id ? event.detail.id : null;
    this.recordId = newId;

    this.dispatchEvent(
      new ShowToastEvent({
        title: 'Account created',
        message: newId ? `Record Id: ${newId}` : 'The Account was created.',
        variant: 'success'
      })
    );

    // Emit a custom event for parent components or flows
    this.dispatchEvent(
      new CustomEvent('accountcreated', {
        detail: { recordId: newId },
        bubbles: true,
        composed: true
      })
    );
  }

  handleError(event) {
    this.isSubmitting = false;

    let message = 'An error occurred while creating the Account.';
    if (event && event.detail && event.detail.detail) {
      message = event.detail.detail;
    } else if (event && event.detail && event.detail.message) {
      message = event.detail.message;
    }

    this.dispatchEvent(
      new ShowToastEvent({
        title: 'Error',
        message,
        variant: 'error'
      })
    );
  }

  // Utility: Normalize error to string
  normalizeError(err) {
    if (!err) return 'Unknown error';
    if (Array.isArray(err.body)) {
      return err.body.map((e) => e.message).join(', ');
    }
    if (err.body && typeof err.body.message === 'string') {
      return err.body.message;
    }
    if (typeof err.message === 'string') {
      return err.message;
    }
    try {
      return JSON.stringify(err);
    } catch (e) {
      return 'Unexpected error';
    }
  }

  // Expose schema refs for potential template usage or future extensibility
  get accountObject() {
    return ACCOUNT_OBJECT;
  }
  get nameField() {
    return NAME_FIELD;
  }
}
