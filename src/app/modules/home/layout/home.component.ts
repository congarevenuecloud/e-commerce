import { Component, OnDestroy, OnInit } from '@angular/core';
import { first, get, slice, reverse, sortBy, last } from 'lodash';
import { Observable, of, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product, Storefront, StorefrontService, CategoryService, ProductService, Category, CartService, Cart, UserService } from '@congarevenuecloud/ecommerce';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  storefront$: Observable<Storefront>;

  productListA$: Observable<Array<Product>>;

  productListB$: Observable<Array<Product>>;

  categories: Array<Category>;
  cart$: Observable<Cart>;
  subscriptions: Array<Subscription> = new Array();

  constructor(private storefrontService: StorefrontService, private userService: UserService,
    private cartService: CartService, private categoryService: CategoryService, private productService: ProductService) {
  }

  ngOnInit() {
    this.storefront$ = this.storefrontService.getStorefront();
    this.cart$ = this.cartService.getMyCart();
    this.subscriptions.push(this.categoryService.getCategories()
      .subscribe(categoryList => {
        this.categories = slice(reverse(sortBy(categoryList, 'ProductCount')), 0, 2);
        this.productListA$ = this.categories.length > 0 ? this.productService.getProducts([get(first(this.categories), 'Id')], 5, 1).pipe(map(results => get(results, 'Products'))) : of([]);
        this.productListB$ = this.categories.length > 0 ? this.productService.getProducts([get(last(this.categories), 'Id')], 5, 1).pipe(map(results => get(results, 'Products'))) : of([]);
      }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
