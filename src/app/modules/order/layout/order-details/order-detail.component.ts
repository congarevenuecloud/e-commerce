import { Component, OnInit, ViewEncapsulation, OnDestroy, ChangeDetectorRef, AfterViewChecked, NgZone, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, BehaviorSubject, combineLatest, of } from 'rxjs';
import { filter, map, switchMap, mergeMap, startWith, take } from 'rxjs/operators';
import { get, set, indexOf, sum, cloneDeep, find, defaultTo, first } from 'lodash';
import { ApiService } from '@congarevenuecloud/core';
import {
  Order, Quote, OrderLineItem, OrderService, UserService,
  ItemGroup, LineItemService, Note, NoteService, EmailService, AccountService, QuoteService,
  Contact, CartService, Cart, OrderLineItemService, Account, ContactService, AttachmentService, ProductInformationService, AttachmentDetails
} from '@congarevenuecloud/ecommerce';
import { ExceptionService, LookupOptions, RevalidateCartService } from '@congarevenuecloud/elements';
@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class OrderDetailComponent implements OnInit, OnDestroy, AfterViewChecked {

  /**
   * Observable instance of an Order.
   */
  order$: BehaviorSubject<Order> = new BehaviorSubject<Order>(null);
  orderLineItems$: BehaviorSubject<Array<ItemGroup>> = new BehaviorSubject<Array<ItemGroup>>(null);
  noteList$: BehaviorSubject<Array<Note>> = new BehaviorSubject<Array<Note>>(null);
  attachmentList$: BehaviorSubject<Array<AttachmentDetails>> = new BehaviorSubject<Array<AttachmentDetails>>(null);

  noteSubscription: Subscription;
  orderSubscription: Subscription;
  attachemntSubscription: Subscription;

  @ViewChild('attachmentSection') attachmentSection: ElementRef;
  @ViewChild('fileInput') fileInput: ElementRef;

  private subscriptions: Subscription[] = [];
  orderGenerated: boolean = false;
  order: Order;

  /**
   * Boolean observable to check if user is logged in.
   */
  isLoggedIn: boolean;

  orderStatusSteps = [
    'Draft',
    'Generated',
    'Presented',
    'Confirmed',
    'In Fulfillment',
    'Fulfilled',
    'Activated'
  ];

  orderStatusMap = {
    'Draft': 'Draft',
    'Confirmed': 'Confirmed',
    'Processing': 'Generated',
    'In Fulfillment': 'In Fulfillment',
    'Partially Fulfilled': 'Partially Fulfilled',
    'Fulfilled': 'Fulfilled',
    'Activated': 'Activated',
    'In Amendment': 'Draft',
    'Being Amended': 'Draft',
    'Superseded': 'Draft',
    'Generated': 'Generated',
    'Presented': 'Presented'
  };

  isLoading: boolean = false;

  note: Note = new Note();

  commentsLoader: boolean = false;

  lineItemLoader: boolean = false;

  attachmentsLoader = false;

  hasSizeError: boolean;

  file: File;

  uploadFileList: any;
  
  isSupportedFileType:boolean = true;

  supportedFileTypes:string;
  
  lookupOptions: LookupOptions = {
    primaryTextField: 'Name',
    secondaryTextField: 'Email',
    fieldList: ['Name', 'Id', 'Email']
  };

  isPrivate: boolean = false;
  maxFileSizeLimit = 29360128;
  cartRecord: Cart;

  constructor(private activatedRoute: ActivatedRoute,
    private orderService: OrderService,
    private userService: UserService,
    private exceptionService: ExceptionService,
    private noteService: NoteService,
    private router: Router,
    private emailService: EmailService,
    private accountService: AccountService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private contactService: ContactService,
    private attachmentService: AttachmentService,
    private quoteService: QuoteService,
    private productInformationService: ProductInformationService,
    private cartService: CartService
  ) { }

  ngOnInit() {
    this.getOrder();
    this.subscriptions.push(this.accountService.getCurrentAccount().subscribe(account => {
      this.lookupOptions.expressionOperator = 'AND';
      this.lookupOptions.filters = null;
      this.lookupOptions.sortOrder = null;
      this.lookupOptions.page = 10;
    }));
    this.subscriptions.push(this.attachmentService.getSupportedAttachmentType().pipe(
      take(1)
    ).subscribe((data: string)=>{
      this.supportedFileTypes = data;
    }))  }

  getOrder() {
    if (this.orderSubscription) this.orderSubscription.unsubscribe();

    const order$ = this.activatedRoute.params
      .pipe(
        filter(params => get(params, 'id') != null),
        map(params => get(params, 'id')),
        mergeMap(orderId => this.orderService.getOrder(orderId)),
        switchMap((order: Order) => {
          return this.updateOrderValue(order)
        })
      );

    this.orderSubscription = combineLatest([order$.pipe(startWith(null)), this.userService.isLoggedIn()])
      .pipe(map(([order, isLoggedIn]) => {
        if (!order) return;
        this.isLoggedIn = isLoggedIn;
        if (order.Status === 'Partially Fulfilled' && indexOf(this.orderStatusSteps, 'Fulfilled') > 0)
          this.orderStatusSteps[indexOf(this.orderStatusSteps, 'Fulfilled')] = 'Partially Fulfilled';

        if (order.Status === 'Fulfilled' && indexOf(this.orderStatusSteps, 'Partially Fulfilled') > 0)
          this.orderStatusSteps[indexOf(this.orderStatusSteps, 'Partially Fulfilled')] = 'Fulfilled';

        order.OrderLineItems = get(order, 'OrderLineItems');
        this.orderLineItems$.next(LineItemService.groupItems(order.OrderLineItems));
        this.cartService.fetchCartStatus(get(get(first(this.orderLineItems$.value), 'MainLine.Configuration'), 'Id')).pipe(take(1)).subscribe(c => {
          this.cartRecord = c;
        })
        return this.updateOrder(order);
      })).subscribe();
    this.getAttachments();
  }

  refreshOrder(fieldValue, order, fieldName) {
    set(order, fieldName, fieldValue);
    const payload: Order = {
      'PrimaryContact': order.PrimaryContact,
      'Description': order.Description,
      'ShipToAccount': order.ShipToAccount,
      'BillToAccount': order.BillToAccount
    } as Order;
    this.subscriptions.push(this.orderService.updateOrder(order.Id, payload).pipe(switchMap(c => this.updateOrderValue(c))).subscribe(r => {
      this.updateOrder(r);
    }));
  }

  deleteAttachment(attachment: AttachmentDetails) {
    attachment.DocumentMetadata.set('deleting', true);
    this.attachmentService.deleteAttachment(attachment.DocumentMetadata.DocumentId).pipe(take(1)).subscribe(() => {
      attachment.DocumentMetadata.set('deleting', false);
      this.getAttachments();
    })
  }

  updateOrderValue(order): Observable<Order> {
    return combineLatest([of(order),
    get(order, 'Proposal') ? this.quoteService.getQuote(`${get(order.Proposal, 'Id')}`) : of(null),
    get(order.BillToAccount, 'Id') ? this.accountService.getAccount(get(order.BillToAccount, 'Id')) : of(null),
    get(order.ShipToAccount, 'Id') ? this.accountService.getAccount(get(order.ShipToAccount, 'Id')) : of(null),
    get(order.PrimaryContact, 'Id') ? this.contactService.fetch(get(order.PrimaryContact, 'Id')) : of(null),
    this.accountService.getCurrentAccount()])
      .pipe(
        map(([order, quote, billToAccount, shipToAccount, contact, soldToAccount]) => {
          order.Proposal = quote;
          order.SoldToAccount = defaultTo(find([soldToAccount], acc => acc.Id === order.SoldToAccount.Id), order.SoldToAccount);
          order.BillToAccount = defaultTo(billToAccount, order.BillToAccount);
          order.ShipToAccount = defaultTo(shipToAccount, order.ShipToAccount);
          order.PrimaryContact = defaultTo(contact, order.PrimaryContact) as Contact;
          set(order, 'PrimaryContact.Account', find(billToAccount, acc => order.PrimaryContact && get(acc, 'Id') === get(order.PrimaryContact.Account, 'Id')));
          this.order = order;
          return order;
        })
      );
  }

  editOrderItems(order: Order) {
    this.lineItemLoader = true;
    this.orderService.convertOrderToCart(order).pipe(take(1)).subscribe(value => {
      set(value, 'Order', this.order);
      this.ngZone.run(() => this.router.navigate(['/carts', 'active']));
    },
      err => {
        this.exceptionService.showError(err);
        this.lineItemLoader = false;
      })
  }

  updateOrder(order) {
    this.ngZone.run(() => this.order$.next(cloneDeep(order)));
  }

  getTotalPromotions(orderLineItems: Array<OrderLineItem> = []): number {
    return orderLineItems.length ? sum(orderLineItems.map(res => res.IncentiveAdjustmentAmount)) : 0;
  }

  getChildItems(orderLineItems: Array<OrderLineItem>, lineItem: OrderLineItem): Array<OrderLineItem> {
    return orderLineItems.filter(orderItem => !orderItem.IsPrimaryLine && orderItem.PrimaryLineNumber === lineItem.PrimaryLineNumber);
  }

  confirmOrder(orderId: string, primaryContactId: string) {
    this.isLoading = true;
    this.subscriptions.push(combineLatest([this.orderService.acceptOrder(orderId), this.emailService.getEmailTemplateByName('DC Order Confirmation Template')]).pipe(
      switchMap(([res, templateInfo]) => {
        this.isLoading = false;
        if (res) {
          this.exceptionService.showSuccess('ACTION_BAR.ORDER_CONFIRMATION_TOASTR_MESSAGE', 'ACTION_BAR.ORDER_CONFIRMATION_TOASTR_TITLE');
        }
        else {
          this.exceptionService.showError('ACTION_BAR.ORDER_CONFIRMATION_FAILURE');
        }
        return templateInfo ? this.emailService.sendEmailNotificationWithTemplate(get(templateInfo, 'Id'), this.order, primaryContactId) : of(null);
      })
    ).subscribe(() => {
      this.getOrder();
    }))
  }

  onGenerateOrder() {
    if (this.attachmentSection) this.attachmentSection.nativeElement.scrollIntoView({ behavior: 'smooth' });
    let obsv$;
    if (get(this.order, 'Status') == 'Draft') {
      const payload = { 'Status': 'Generated' };
      obsv$ = this.orderService.updateOrder(this.order.Id, payload as Order);
    } else {
      obsv$ = of(null);
    }

    combineLatest([this.emailService.getEmailTemplateByName('DC Order generate-document Template'), obsv$]).pipe(
      switchMap(result => {
        return first(result) ? this.emailService.sendEmailNotificationWithTemplate(get(first(result), 'Id'), this.order, get(this.order.PrimaryContact, 'Id')) : of(null)
      }), take(1)).subscribe(() => { this.getOrder(); });
  }

  addComment(orderId: string) {
    this.commentsLoader = true;
    set(this.note, 'ParentId', orderId);
    set(this.note, 'OwnerId', get(this.userService.me(), 'Id'));
    if (!this.note.Name) {
      set(this.note, 'Name', 'Notes Title');
    }
    this.noteService.create([this.note])
      .subscribe(r => {
        this.clear();
        this.commentsLoader = false;
      },
        err => {
          this.exceptionService.showError(err);
          this.commentsLoader = false;
        });
  }

  clear() {
    set(this.note, 'Body', null);
    set(this.note, 'Title', null);
    set(this.note, 'Id', null);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());

    if (this.orderSubscription) {
      this.orderSubscription.unsubscribe();
    }

    if (this.noteSubscription) {
      this.noteSubscription.unsubscribe();
    }
  }

  ngAfterViewChecked() {
    this.cdr.detectChanges();
  }

  clearFiles() {
    this.file = null;
    this.uploadFileList = null;
    this.attachmentsLoader = false;
    this.isPrivate = false;
    this.fileInput.nativeElement.value = null;
    this.isSupportedFileType = true;
  }

  getAttachments() {
    if (this.attachemntSubscription) this.attachemntSubscription.unsubscribe();
    this.attachemntSubscription = this.activatedRoute.params
      .pipe(
        switchMap(params => this.attachmentService.getAttachments(get(params, 'id'), 'order'))
      ).subscribe((attachments: Array<AttachmentDetails>) => this.ngZone.run(() => this.attachmentList$.next(attachments)));
  }

  uploadAttachment(parentId: string) {
    this.attachmentsLoader = true;
    this.attachmentService.uploadAttachment(this.file, this.isPrivate, parentId, 'order').pipe(take(1)).subscribe(res => {
      this.getAttachments();
      this.attachmentsLoader = false;
      this.clearFiles();
      this.cdr.detectChanges();
    }, err => {
      this.clearFiles();
      this.exceptionService.showError(err);
    });
  }

  downloadAttachment(attachmentId: string) {
    this.productInformationService.getAttachmentUrl(attachmentId).subscribe((url: string) => {
      window.open(url, '_blank');
    });
  }

  hasFileSizeExceeded(fileList, maxSize) {
    let totalFileSize = 0;
    for (let i = 0; i < fileList.length; i++) {
      totalFileSize = totalFileSize + fileList[i].size;
    }
    this.hasSizeError = totalFileSize > maxSize;
  }

  fileChange(event) {
    const fileList: FileList = event.target.files;
    if (fileList.length > 0) {
      this.uploadFileList = event.target.files;
      this.hasFileSizeExceeded(this.uploadFileList, this.maxFileSizeLimit);
      this.file = fileList[0];
      this.isSupportedFileType = this.attachmentService.checkSupportedFileType(this.uploadFileList,this.supportedFileTypes);
    }
  }

  onDragFile(event) {
    event.preventDefault();
  }

  onDropFile(event) {
    event.preventDefault();
    const itemList: DataTransferItemList = event.dataTransfer.items;
    const fileList: FileList = event.dataTransfer.files;
    if (fileList.length > 0) {
      this.uploadFileList = event.dataTransfer.files;
      this.hasFileSizeExceeded(this.uploadFileList, event.target.dataset.maxSize);
      this.isSupportedFileType = this.attachmentService.checkSupportedFileType(this.uploadFileList,this.supportedFileTypes);
    } else {
      let f = [];
      for (let i = 0; i < itemList.length; i++) {
        if (itemList[i].kind === 'file') {
          let file: File = itemList[i].getAsFile();
          f.push(file);
        }
        this.uploadFileList = f;
      }
      this.hasFileSizeExceeded(fileList, event.target.dataset.maxSize);
    }
    this.file = this.uploadFileList[0];
  }
}
