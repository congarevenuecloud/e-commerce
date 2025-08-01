import { Component, OnInit, Output, EventEmitter, Input, ViewChild, OnDestroy } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { BsDatepickerConfig } from 'ngx-bootstrap/datepicker';
import { Observable, of, combineLatest, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { get, lowerCase } from 'lodash';
import { TabsetComponent } from 'ngx-bootstrap/tabs';
import {
  AccountService, ContactService, UserService, Quote, QuoteService, PriceListService, Cart,
  Note, Account, Contact, PriceList, StorefrontService
} from '@congarevenuecloud/ecommerce';
import { LookupOptions } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-request-quote-form',
  templateUrl: './request-quote-form.component.html',
  styleUrls: ['./request-quote-form.component.scss']
})
export class RequestQuoteFormComponent implements OnInit, OnDestroy {
  @ViewChild('staticTabs') staticTabs: TabsetComponent;
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
  note: Note = new Note();
  comments: any = [];

  shipToAccount$: Observable<Account>;
  billToAccount$: Observable<Account>;
  priceList$: Observable<PriceList>;
  lookupOptions: LookupOptions = {
    primaryTextField: 'Name',
    secondaryTextField: 'Email',
    fieldList: ['Id', 'Name', 'Email']
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

  constructor(public quoteService: QuoteService,
    private accountService: AccountService,
    private userService: UserService,
    private plservice: PriceListService,
    private translateService: TranslateService,
    private contactService: ContactService,
    private storefrontService: StorefrontService) { }

  ngOnInit() {
    this.quote.Name = 'Test';
    combineLatest(this.accountService.getCurrentAccount(),
      this.userService.me(),
      (this.cart.Proposald ? this.quoteService.getQuoteById(get(this.cart, 'Proposald.Id')) : of(null)),
      this.storefrontService.getStorefront())
      .pipe(take(1)).subscribe(([account, user, quote, storefront]) => {
        this.isGuest = lowerCase(user.Alias) === 'guest';
        this.primaryContact = new Contact();
        this.quote.ShipToAccount = account;
        this.quote.ProposalName = 'New Quote'
        this.quote.BillToAccount = account;
        this.quote.Account = get(this.cart, 'Account');
        this.quote.PrimaryContact = this.isGuest ? this.primaryContact : get(user, 'Contact');
        this.contact = this.cart.Proposald ? get(quote[0], 'PrimaryContact.Id') : get(user, 'Contact.Id');
        if (get(this.cart, 'Proposald.Id')) {
          this.quote = get(this.cart, 'Proposald');
          this.quote.ProposalName = quote.Name;
        };
        this.quote.Requestor = account?.Owner || user;
        this.quote.SourceChannel = get(storefront, 'ChannelType');
        this.quoteChange();
        this.getPriceList
      });

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
   * This method adds comments to requesting quote.
   */
  addComment() {
    if (this.quote) {
      this.quote.Description = this.note.Description;
      this.onQuoteUpdate.emit(this.quote);
    }
  }

  /**
   * @ignore
   */
  quoteChange() {
    this.onQuoteUpdate.emit(this.quote);
  }

  shipToChange() {
    this.shipToAccount$ = this.accountService.getAccount(get(this.quote.ShipToAccount, 'Id'));
    this.shipToAccount$.pipe(take(1)).subscribe((newShippingAccount) => {
      this.quote.ShipToAccount = newShippingAccount;
      this.onQuoteUpdate.emit(this.quote);
    });
  }

  billToChange() {
    this.billToAccount$ = this.accountService.getAccount(get(this.quote.BillToAccount, 'Id'));
    this.billToAccount$.pipe(take(1)).subscribe((newBillingAccount) => {
      this.quote.BillToAccount = newBillingAccount;
      this.onQuoteUpdate.emit(this.quote);
    });

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
    * @param event The event that was fired.
    */
  primaryContactChange() {
    if (get(this.contact, 'Id')) {
      this.contactService.fetch(get(this.contact, 'Id'))
        .pipe(take(1))
        .subscribe((newPrimaryContact: Contact) => {
          this.quote.PrimaryContact = newPrimaryContact;
          this.onQuoteUpdate.emit(this.quote);
        });
    } else if (get(this.quote.PrimaryContact, 'Id')) {
      this.onQuoteUpdate.emit(this.quote);
    }
    else {
      this.quote.PrimaryContact = null;
      this.onQuoteUpdate.emit(this.quote);
    }
  }

  /**
   * Allow to switch address tabs if billing and shipping address are diffrent.
   *
   * @param evt Event that identifies if Shipping and billing addresses are same.
   *
   */
  selectTab(evt) {
    if (evt)
      this.staticTabs.tabs[0].active = true;
    else {
      setTimeout(() => this.staticTabs.tabs[1].active = true, 50);
    }
  }

}
