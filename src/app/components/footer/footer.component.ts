import { Component, Input, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { finalize, Observable, of, Subscription, switchMap, take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { get, slice } from 'lodash';
import { Storefront, StorefrontService, EmailService, Category, EmailTemplate, EmailRequestPayload } from '@congarevenuecloud/ecommerce';
import { ExceptionService } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {

  @Input() categories: Array<Category> = new Array();

  storefront$: Observable<Storefront>;
  currentYear: string = null;
  copyrightMessage: string;
  subscriptions: Array<Subscription> = new Array();
  footerCategories: Array<Category> = new Array();
  contactFormEmailTemplate = 'Ecommerce_GetInTouch_EmailTemplate'; // Email template name to be used for the contact form
  contactFormDetails: ContactFormDetails = {
    name: '',
    email: '',
    message: ''
  }
  accountInquiryDetails: any = null; // Account details to be used for the contact form
  contactFormLoading: boolean = false;
  showFavorites$: Observable<boolean>;


  constructor(private storefrontService: StorefrontService, private translateService: TranslateService, private emailService: EmailService, private exceptionService: ExceptionService) { }

  ngOnInit() {
    this.storefront$ = this.storefrontService.getStorefront();
    this.showFavorites$ = this.storefrontService.isFavoriteEnabled();
    this.currentYear = new Date().getFullYear().toString();
    this.subscriptions.push(this.translateService.stream('FOOTER.CONGA_COPYRIGHT', { currentYear: this.currentYear }).subscribe((
      copyright: string) => {
      this.copyrightMessage = copyright;
    }));
    this.footerCategories = slice(this.categories, 0, 7);

    // Retrieve the account owner and email address from ConfigSystemProperties, tied to the storefront configuration, for use in the "Get in Touch" form payload.
    this.subscriptions.push(this.storefrontService.getConfigSettings().subscribe((configSettings: any) => {
      this.accountInquiryDetails = get(configSettings, 'EnableGetInTouchFormInDC', null);
    }))
  }

  ngOnChanges() {
    if (this.categories && this.categories.length > 0) {
      this.categories = slice(this.categories, 0, 7);
    }
  }

  onContactFormSubmit(form: NgForm): void {

    if (!form.valid) return;

    this.contactFormLoading = true;

    const buyerName = this.contactFormDetails?.name;
    const buyerEmail = this.contactFormDetails?.email;
    const buyerMessage = this.contactFormDetails?.message;
    const accountOwner = get(this.accountInquiryDetails, 'AccountOwner');
    const accountEmail = get(this.accountInquiryDetails, 'EmailAddress');

    this.emailService.getEmailTemplateByName(this.contactFormEmailTemplate).pipe(
      take(1),
      switchMap((template: EmailTemplate) => {
        const emailRequestPayload: EmailRequestPayload = {
          EmailTemplateId: template.Id,
          EmailRequestWrappers: [
            {
              EmailTemplateParameters: {
                TemplateData: {
                  AccountOwner: accountOwner,
                  Buyer: {
                    Name: buyerName,
                    Email: buyerEmail,
                    Message: buyerMessage
                  }
                }
              },
              EmailParameters: {
                To: [{
                  Address: accountEmail,
                  DisplayName: accountOwner
                }]
              }
            }
          ]
        };

        return this.emailService.sendEmailByTemplate(emailRequestPayload);
      }),
      finalize(() => {
        this.contactFormLoading = false;
      })
    ).subscribe({
      next: () => {
        this.resetContactForm();
        this.exceptionService.showSuccess('FOOTER.CONTACT_US_FORM.SUBMITTED', 'EMAIL.SUCCESS.THANK_YOU');
      },
      error: () => {
        this.resetContactForm();
        this.exceptionService.showError('FOOTER.CONTACT_US_FORM.ERROR', 'EMAIL.FAILURE.DID_NOT_WORK');
      }
    });
  }


  private resetContactForm() {
    this.contactFormDetails = { name: '', email: '', message: '' };
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}


interface ContactFormDetails {
  name: string;
  email: string;
  message: string;
}
