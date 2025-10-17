import { Component, OnInit, ViewEncapsulation, OnDestroy, ChangeDetectorRef, AfterViewChecked, NgZone, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, BehaviorSubject, combineLatest, of } from 'rxjs';
import { filter, map, switchMap, mergeMap, take } from 'rxjs/operators';
import { get, set, indexOf, sum, cloneDeep, first, isNil, map as _map, join, split, trim } from 'lodash';
import {
  Order, OrderLineItem, OrderService, UserService,
  ItemGroup, LineItemService, EmailService, AccountService,
  Cart, AttachmentService, ProductInformationService, AttachmentDetails
} from '@congarevenuecloud/ecommerce';
import { ExceptionService, LookupOptions, FileOutput } from '@congarevenuecloud/elements';
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
  attachmentList$: BehaviorSubject<Array<AttachmentDetails>> = new BehaviorSubject<Array<AttachmentDetails>>(null);

  orderSubscription: Subscription;
  attachmentSubscription: Subscription;

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

  lineItemLoader: boolean = false;

  attachmentsLoader = false;

  supportedFileTypes: string;

  lookupOptions: LookupOptions = {
    primaryTextField: 'Name',
    secondaryTextField: 'Email',
    fieldList: ['Name', 'Id', 'Email']
  };

  isPrivate: boolean = false;
  maxFileSizeLimit = 29360128;
  cartRecord: Cart = new Cart();
  // Flag used to toggle the content visibility when the list of fields exceeds two rows of the summary with show more or show less icon.
  isExpanded: boolean = false;

  constructor(private activatedRoute: ActivatedRoute,
    private orderService: OrderService,
    private userService: UserService,
    private exceptionService: ExceptionService,
    private router: Router,
    private emailService: EmailService,
    private accountService: AccountService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private attachmentService: AttachmentService,
    private productInformationService: ProductInformationService
  ) { }

  ngOnInit() {
    this.getOrder();
    this.subscriptions.push(this.accountService.getCurrentAccount().subscribe(account => {
      this.lookupOptions.expressionOperator = 'AND';
      this.lookupOptions.filters = null;
      this.lookupOptions.sortOrder = null;
      this.lookupOptions.page = 10;
    }));
    this.subscriptions.push(this.userService.isLoggedIn().pipe(switchMap((value: boolean) => {
      this.isLoggedIn = value;
      if (this.isLoggedIn)
        return this.attachmentService.getSupportedAttachmentType();
      else
        return of(null);
    }), take(1)
    ).subscribe(data => {
      this.supportedFileTypes = join(_map(split(data, ','), (item) => trim(item)), ', ');
    }))
  }

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

    this.orderSubscription = order$.pipe(switchMap((order) => {
      if (isNil(order)) return;
      if (order.Status === 'Partially Fulfilled' && indexOf(this.orderStatusSteps, 'Fulfilled') > 0)
        this.orderStatusSteps[indexOf(this.orderStatusSteps, 'Fulfilled')] = 'Partially Fulfilled';

      if (order.Status === 'Fulfilled' && indexOf(this.orderStatusSteps, 'Partially Fulfilled') > 0)
        this.orderStatusSteps[indexOf(this.orderStatusSteps, 'Partially Fulfilled')] = 'Fulfilled';

      order.OrderLineItems = get(order, 'OrderLineItems');
      this.orderLineItems$.next(LineItemService.groupItems(order.OrderLineItems));
      set(this.cartRecord, 'Id', get(get(first(this.orderLineItems$.value), 'MainLine.Configuration'), 'Id'));
      this.cartRecord.BusinessObjectType = 'Order';
      return of(order);
    }), take(1)).subscribe(order => {
      this.updateOrder(order)
    });
    this.getAttachments();
  }

  refreshOrder(fieldValue, order, fieldName) {
    set(order, fieldName, fieldValue);
    const orderItems = get(order, 'OrderLineItems');
    const payload: Order = {
      'PrimaryContact': order.PrimaryContact,
      'Description': order.Description,
      'ShipToAccount': order.ShipToAccount,
      'BillToAccount': order.BillToAccount
    } as Order;
    this.subscriptions.push(this.orderService.updateOrder(order.Id, payload).pipe(switchMap(c => this.updateOrderValue(c))).subscribe(r => {
      set(r, 'OrderLineItems', orderItems);
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

  updateOrderValue(order: Order): Observable<Order> {
    return this.orderService.updateOrderValue(order).pipe(
      take(1),
      map((updatedOrder: Order) => {
        this.order = updatedOrder;
        return updatedOrder;
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


  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());

    if (this.orderSubscription) {
      this.orderSubscription.unsubscribe();
    }
  }

  ngAfterViewChecked() {
    this.cdr.detectChanges();
  }

  getAttachments() {
    if (this.attachmentSubscription) this.attachmentSubscription.unsubscribe();
    this.attachmentSubscription = this.activatedRoute.params
      .pipe(
        switchMap(params => this.attachmentService.getAttachments(get(params, 'id'), 'order'))
      ).subscribe((attachments: Array<AttachmentDetails>) => this.ngZone.run(() => this.attachmentList$.next(attachments)));
  }

  uploadAttachments(fileInput: FileOutput) {
    this.attachmentsLoader = true;
    const fileList = fileInput.files;
    this.isPrivate = fileInput.visibility;
    // To control the visibility of files, pass the additional field "IsPrivate_c" as part of the customProperties when calling uploadMultipleAttachments.
    // You must include "IsPrivate_c" or any other custom fields passed as method parameters to the DocumentMetadata object. For more details, please refer to SDK/product documentation.
    this.attachmentService.uploadMultipleAttachments(fileList, this.order.Id, 'Order', {
      IsPrivate_c: this.isPrivate
    }).pipe(take(1)).subscribe(res => {
      this.getAttachments();
      this.attachmentsLoader = false;
      this.cdr.detectChanges();
    }, err => {
      this.exceptionService.showError(err);
    });
  }

  downloadAttachment(attachmentId: string) {
    this.productInformationService.getAttachmentUrl(attachmentId).subscribe((url: string) => {
      window.open(url, '_blank');
    });
  }

}
