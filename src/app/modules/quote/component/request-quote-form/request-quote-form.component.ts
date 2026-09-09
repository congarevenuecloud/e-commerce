import { Component, OnInit, Output, EventEmitter, Input, ViewChild, OnDestroy } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { BsDatepickerConfig } from 'ngx-bootstrap/datepicker';
import { Observable, of, combineLatest, Subscription } from 'rxjs';
import { take, map, switchMap, tap, filter } from 'rxjs/operators';
import { get, lowerCase, clone, isNil } from 'lodash';
import { FilterOperator } from '@congarevenuecloud/core';
import {
  AccountService, ContactService, UserService, Quote, QuoteService, PriceListService, Cart,
  Account, Contact, PriceList, StorefrontService
} from '@congarevenuecloud/ecommerce';
import { LookupOptions } from '@congarevenuecloud/elements';

@Component({
    selector: 'app-request-quote-form',
    templateUrl: './request-quote-form.component.html',
    styleUrls: ['./request-quote-form.component.scss'],
    standalone: false
})
export class RequestQuoteFormComponent implements OnInit, OnDestroy {
  @ViewChild('form', { static: false }) form: NgForm;
  @Input() cart: Cart;
  @Output() onQuoteUpdate = new EventEmitter<Quote>();

  /**
   * An Observable containing the current contact record
   */
  subscriptions: Subscription[] = [];
  primaryContact: Contact;
  quote = new Quote();
  bsConfig: Partial<BsDatepickerConfig>;
  startDate: Date = new Date();
  rfpDueDate: Date = new Date();

  shipToAccount$: Observable<Account>;
  billToAccount$: Observable<Account>;
  priceList$: Observable<PriceList>;
  /**
   * Lookup config for the internal-user Primary Contact dropdown. Restricts results to contacts
   * belonging to the app-level (current) account; the account id is set once resolved in ngOnInit.
   */
  primaryContactLookupOptions: LookupOptions = {
    primaryTextField: 'Name',
    secondaryTextField: 'Email',
    fieldList: ['Id', 'Name', 'Email'],
    filters: [{ field: 'Account.Id', value: null, filterOperator: FilterOperator.EQUAL }]
  };

  /**
   * Boolean specifies if shipping and billing addresses are same.
   */
  shippingEqualsBilling: boolean = true;

  errMessages: any = {
    requiredFirstName: '',
    requiredLastName: '',
    requiredEmail: '',
    requiredPrimaryContact: '',
    requiredProposalName: ''
  };

  contact: string;
  isGuest: boolean = false;
  /**
   * True when the logged in user is an external (Contact) user. External users have a single
   * contact and a fixed account, so Primary Contact / Ship To / Bill To are defaulted and shown
   * read-only instead of as lookups.
   */
  isExternalUser: boolean = false;

  constructor(public quoteService: QuoteService,
    private accountService: AccountService,
    private userService: UserService,
    private plservice: PriceListService,
    private translateService: TranslateService,
    private contactService: ContactService,
    private storefrontService: StorefrontService) { }

  ngOnInit() {
    this.quote.Name = 'Test';
    combineLatest([
      this.accountService.getCurrentAccount(),
      this.userService.me(),
      (this.cart.Proposald ? this.quoteService.getQuoteById(get(this.cart, 'Proposald.Id')) : of(null)),
      this.storefrontService.getStorefront()
    ]).pipe(take(1)).subscribe(([account, user, quote, storefront]) => {
      this.isGuest = lowerCase(user.Alias) === 'guest';
      // Scope the internal-user Primary Contact lookup to the app-level (current) account.
      this.primaryContactLookupOptions.filters = [{ field: 'Account.Id', value: get(account, 'Id'), filterOperator: FilterOperator.EQUAL }];
      this.primaryContact = new Contact();
      this.billToAccount$ = of(null);
      this.shipToAccount$ = of(null);
      this.quote.ProposalName = 'New Quote';
      this.quote.Account = get(this.cart, 'Account');
      this.quote.PrimaryContact = this.isGuest ? this.primaryContact : get(user, 'Contact');
      this.contact = this.cart.Proposald ? get(quote[0], 'PrimaryContact.Id') : get(user, 'Contact.Id');
      // Contacts are filtered to the app-level account, so Ship To / Bill To are always that account.
      this.quote.BillToAccount = account;
      this.quote.ShipToAccount = account;
      if (get(this.cart, 'Proposald.Id')) {
        this.quote = get(this.cart, 'Proposald');
        this.quote.ProposalName = quote.Name;
      };
      this.quote.SourceChannel = get(storefront, 'ChannelType');
      this.emitQuote();
      this.getPriceList();
    });

    // External (Contact) users have a single contact; default the read-only Primary Contact to it,
    // resolved via the user-contact mapping. Ship To / Bill To are already set to the current account above.
    this.subscriptions.push(
      this.userService.isExternalUser().pipe(
        tap(isExternal => this.isExternalUser = isExternal),
        filter(isExternal => isExternal),
        switchMap(() => this.userService.getUserContactMapping()),
        // Only proceed when the mapping resolves to a Contact record with an id.
        filter(mapping => get(mapping, 'ContactObjectName') === 'Contact' && !isNil(get(mapping, 'ContactObjectId'))),
        map(mapping => get(mapping, 'ContactObjectId')),
        switchMap(contactId => this.contactService.getContactById(contactId)),
        take(1)
      ).subscribe((contact: Contact) => {
        this.quote.PrimaryContact = contact;
        this.emitQuote();
      })
    );

    this.subscriptions.push(
      combineLatest([
        this.translateService.stream('CHECKOUT_PAGE.INVALID_FIRSTNAME'),
        this.translateService.stream('CHECKOUT_PAGE.INVALID_LASTNAME'),
        this.translateService.stream('CHECKOUT_PAGE.INVALID_EMAIL'),
        this.translateService.stream('CHECKOUT_PAGE.INVALID_PRIMARY_CONTACT'),
        this.translateService.stream('CHECKOUT_PAGE.INVALID_PROPOSAL_NAME')
      ]).subscribe(([
        invalidFirstName,
        invalidLastName,
        invalidEmail,
        invalidPrimaryContact,
        invalidProposalName
      ]) => {
        this.errMessages.requiredFirstName = invalidFirstName;
        this.errMessages.requiredLastName = invalidLastName;
        this.errMessages.requiredEmail = invalidEmail;
        this.errMessages.requiredPrimaryContact = invalidPrimaryContact;
        this.errMessages.requiredProposalName = invalidProposalName;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * @ignore
   */
  quoteChange() {
    this.onQuoteUpdate.emit(this.quote);
  }

  /** Emits the quote as a new reference so the OnPush read-only fields (apt-output-field) re-render. */
  private emitQuote() {
    this.quote = clone(this.quote);
    this.onQuoteUpdate.emit(this.quote);
  }

  onShippingLocationChange() {
    this.emitQuote();
  }

  getPriceList() {
    this.priceList$ = this.plservice.getPriceList();
    this.priceList$.pipe(take(1)).subscribe((newPricelList) => {
      this.quote.PriceList = newPricelList;
      this.onQuoteUpdate.emit(this.quote);
    });
  }
  /**
    * Event handler for when the primary contact input changes.
    * Ship To / Bill To are fixed to the app-level account (contacts are already filtered to it),
    * so we only re-emit the quote for the selected contact.
    */
  primaryContactChange() {
    this.emitQuote();
  }

}
