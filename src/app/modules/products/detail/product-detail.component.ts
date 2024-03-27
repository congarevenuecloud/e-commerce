import { Component, OnInit, ViewChild, OnDestroy, TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { get, isNil, find, forEach, maxBy, filter, has, defaultTo, first, set } from 'lodash';
import { combineLatest, Observable, Subscription, of, BehaviorSubject } from 'rxjs';
import { switchMap, map as rmap, distinctUntilChanged, take } from 'rxjs/operators';

import {
    CartService,
    CartItem,
    ConstraintRuleService,
    Product,
    ProductService,
    ProductInformationService,
    ProductInformation,
    StorefrontService,
    Storefront,
    PriceListItemService,
    Cart,
    ItemRequest
} from '@congarevenuecloud/ecommerce';
import { ProductConfigurationComponent, ProductConfigurationSummaryComponent, ProductConfigurationService, RevalidateCartService } from '@congarevenuecloud/elements';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
@Component({
    selector: 'app-product-detail',
    templateUrl: './product-detail.component.html',
    styleUrls: ['./product-detail.component.scss']
})
/**
 * Product Details Component is the details of the product for standalone and bundle products with attributes and options.
 */
export class ProductDetailComponent implements OnInit, OnDestroy {

    @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;

    viewState$: BehaviorSubject<ProductDetailsState> = new BehaviorSubject<ProductDetailsState>(null);
    recommendedProducts$: Observable<Array<ItemRequest>>;

    attachments$: Observable<Array<ProductInformation>>;
    modalRef: BsModalRef;
    cartItemList: Array<CartItem>;
    product: Product;
    subscriptions: Array<Subscription> = new Array<Subscription>();

    /**
     * Flag to detect if there is change in product configuration.
     */
    configurationChanged: boolean = false;

    /**@ignore */
    relatedTo: CartItem;
    cart: Cart;
    netPrice: number = 0;

    private configurationLayout: string = null;

    currentQty: number;

    @ViewChild(ProductConfigurationSummaryComponent, { static: false })
    configSummaryModal: ProductConfigurationSummaryComponent;
    @ViewChild(ProductConfigurationComponent, { static: false })
    productConfigComponent: ProductConfigurationComponent;
    primaryLineItem: CartItem = null;
    unsavedConfiguration: boolean = false;
    handleredirect: boolean = true;
    activeCart: Cart = null;
    configurationPending: boolean;
    disabled: boolean = false;
    discovery: string;

    constructor(private cartService: CartService,
        private router: Router,
        private route: ActivatedRoute,
        private productService: ProductService,
        private productInformationService: ProductInformationService,
        private storefrontService: StorefrontService,
        private productConfigurationService: ProductConfigurationService,
        private crService: ConstraintRuleService,
        private revalidateCartService: RevalidateCartService,
        private modalService: BsModalService) {
    }

    ngOnInit() {
        this.subscriptions.push(this.route.params.pipe(
            switchMap(params => {
                this.productConfigurationService.onChangeConfiguration(null);
                this.product = null;
                this.cartItemList = null;
                const product$ = (this.product instanceof Product && get(params, 'id') === this.product.Id) ? of(this.product) :
                    this.productService.fetch(get(params, 'id'));
                const cartItem$ = this.cartService.getMyCart().pipe(
                    rmap(cart => {
                        this.cart = cart;
                        const cartItem = find(get(cart, 'LineItems'), { Id: get(params, 'cartItem') });
                        return isNil(get(cartItem, 'Id')) ? null : cartItem;
                    }),
                    distinctUntilChanged((oldCli, newCli) => get(newCli, 'Quantity') === this.currentQty)
                );
                // TODO: Needs to be removed when product features are part of get products API call (CPQ-52267)
                const productFeatureValues$ = this.productService.getProductsWithFeatureValues([get(params, 'id')]).pipe(rmap((products: Array<Product>) => get(first(products), 'ProductFeatureValues')));
                return combineLatest([product$, cartItem$, this.storefrontService.getStorefront(), this.revalidateCartService.revalidateFlag, productFeatureValues$]);
            }),
            switchMap(([product, cartItemList, storefront, revalidate, productFeatureValues]) => {
                if (!isNil(cartItemList)) {
                    this.subscriptions.push(this.cartService.updateConfigStatusDetails(cartItemList).pipe(take(1)).subscribe());
                }
                const pli = PriceListItemService.getPriceListItemForProduct(product as Product);
                this.currentQty = isNil(cartItemList) ? defaultTo(get(pli, 'DefaultQuantity'), 1) : get(cartItemList, 'Quantity', 1);
                return combineLatest([of(product), of(cartItemList), of(storefront), of(revalidate), of(productFeatureValues), this.productConfigurationService.changeProductQuantity(this.currentQty)])
            }),
            rmap(([product, cartItemList, storefront, revalidate, productFeatureValues, qty]) => {
                this.recommendedProducts$ = this.crService.getRecommendationsForProduct(product?.Id);
                const pli = PriceListItemService.getPriceListItemForProduct(product as Product);
                this.currentQty = isNil(cartItemList) ? defaultTo(get(pli, 'DefaultQuantity'), 1) : get(cartItemList, 'Quantity', 1);
                this.productConfigurationService.changeProductQuantity(this.currentQty);
                this.product = product as Product;
                this.discovery = this.storefrontService.getDiscovery();
                this.disabled = revalidate;
                set(product, 'ProductFeatureValues', productFeatureValues);
                if (!isNil(cartItemList)) this.primaryLineItem = cartItemList;
                return {
                    product: product as Product,
                    relatedTo: cartItemList as CartItem,
                    quantity: this.currentQty,
                    storefront: storefront
                };
            })
        ).subscribe(r => this.viewState$.next(r)));
        this.subscriptions.push(this.productConfigurationService.unsavedConfiguration.subscribe(res => {
            this.unsavedConfiguration = res;
        }));

        this.subscriptions.push(this.productConfigurationService.configurationChange.subscribe(response => {
            if (get(response, 'configurationChanged')) this.configurationChanged = true;
            this.activeCart = get(response, 'cart') ? get(response, 'cart') : null;
            this.configurationPending = get(response, 'hasErrors');
            this.netPrice = defaultTo(get(response, 'netPrice'), 0);
            this.relatedTo = get(this.viewState$, 'value.relatedTo');
            this.product = get(response, 'product');
            this.cartItemList = get(response, 'itemList');
            if (get(response, 'configurationFlags.optionChanged') || get(response, 'configurationFlags.attributeChanged')) this.configurationChanged = true;
            if (!isNil(this.cartItemList)) this.primaryLineItem = find(this.cartItemList, (r) => get(r, 'LineType') == 'Product/Service');
        }));
    }

    /**
     * onConfigurationChange method is invoked whenever there is change in product configuration and this method sets flag
     * isConfigurationChanged to true.
     */
    onConfigurationChange([product, cartItemList, status]) {
        this.product = product;
        this.cartItemList = cartItemList;
        if (get(status, 'optionChanged') || get(status, 'attributeChanged')) this.configurationChanged = true;
    }


    /**
     * Changes the quantity of the cart item passed to this method.
     *
     * @param cartItem Cart item reference to the cart line item object.
     * @fires CartService.updateCartItems()
     */

    handleStartChange(cartItem: CartItem) {
        this.cartService.updateCartItems([cartItem]);
    }

    onAddToCart(cartItems: Array<CartItem>): void {
        this.productConfigurationService.unsavedConfiguration.next(false);
        this.configurationChanged = false;
        const primaryItem = find(cartItems, i => get(i, 'IsPrimaryLine') === true && isNil(get(i, 'Option')));
        if (!isNil(primaryItem) && (get(primaryItem, 'Product.HasOptions') || get(primaryItem, 'Product.HasAttributes'))) {
            this.router.navigate(['/products', get(this, 'product.Id'), get(primaryItem, 'Id')]);
        }

        if (!isNil(this.relatedTo) && (get(this.relatedTo, 'HasOptions') || get(this.relatedTo, 'HasAttributes')))
            this.router.navigate(['/products', get(this.viewState$, 'value.product.Id'), get(this.relatedTo, 'Id')]);

        this.productConfigurationService.onChangeConfiguration({
            product: get(this, 'product'),
            itemList: cartItems,
            configurationChanged: false,
            hasErrors: false
        });
    }

    /**
     * Change the product quantity and update the primary cartItem
     * to see the updated the netprice of the product.
     */
    changeProductQuantity(newQty: any) {
        if (this.cartItemList && this.cartItemList.length > 0)
            forEach(this.cartItemList, c => {
                if (c.LineType === 'Product/Service') c.Quantity = newQty;
                this.subscriptions.push(this.productConfigurationService.changeProductQuantity(newQty).subscribe(() => { }));
            });
    }

    changeProductToOptional(event: boolean) {
        if (this.cartItemList && this.cartItemList.length > 0)
            forEach(this.cartItemList, c => {
                c.IsOptional = event;
            });
        this.productConfigurationService.changeItemToOptional(this.cartItemList);
    }
    /**
     * Changes the quantity of the cart item passed to this method.
     *
     * @param cartItem Cart item reference to the cart line item object.
     * @fires CartService.updateCartItems()
     */
    handleEndDateChange(cartItem: CartItem) {
        this.cartService.updateCartItems([cartItem]);
    }

    showSummary() {
        this.configSummaryModal.show();
    }


    getPrimaryItem(cartItems: Array<CartItem>): CartItem {
        let primaryItem: CartItem;
        if (isNil(this.relatedTo)) {
            primaryItem = maxBy(filter(cartItems, i => get(i, 'LineType') === 'Product/Service' && isNil(get(i, 'Option')) && get(this, 'product.Id') === get(i, 'ProductId')), 'PrimaryLineNumber');
        }
        else {
            primaryItem = find(cartItems, i => get(i, 'LineType') === 'Product/Service' && i.PrimaryLineNumber === get(this, 'relatedTo.PrimaryLineNumber') && isNil(get(i, 'Option')));
        }
        return primaryItem;
    }

    ngOnDestroy() {
        forEach(this.subscriptions, item => {
            if (item) item.unsubscribe();
        });
    }
}

/** @ignore */
export interface ProductDetailsState {
    /**
     * The product to display.
     */
    product: Product;
    /**
     * The CartItem related to this product.
     */
    relatedTo: CartItem;
    /**
     * Quantity to set to child components
     */
    quantity: number;
    /**
     * The storefront.
     */
    storefront: Storefront;
}
