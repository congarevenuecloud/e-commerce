import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { map, skip } from 'rxjs/operators';
import { first, get, forEach, isNil } from 'lodash';
import { Product, CategoryService, ProductService, Category, UserService, ItemRequest, GuestUserService, CartService } from '@congarevenuecloud/ecommerce';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  productListA$: Observable<Array<ItemRequest>>;

  productListB$: Observable<Array<ItemRequest>>;

  categories: Array<Category> = [];
  isCategoryLoading: boolean = true;
  subscriptions: Array<Subscription> = new Array();
  listItem: Array<ItemRequest> = [];
  counter: number = 3;
  isInvalidGuest: boolean = false;
  loadData$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(private userService: UserService, private guestUserService: GuestUserService,
    private categoryService: CategoryService, private productService: ProductService, private cartService: CartService) {
  }

  ngOnInit() {
    this.subscriptions.push(this.guestUserService.isValidUser().subscribe(isValid => {
      this.loadData$.next(true);
      if (!isValid) {
        this.isInvalidGuest = true;
        const interval = setInterval(() => {
          this.counter--;
          if (this.counter <= 1) {
            clearInterval(interval);
            this.userService.login();
          }
        }, 1000);
      }
    }));
    this.isCategoryLoading = true;
    this.subscriptions.push(this.categoryService.getCategories().pipe(skip(1))
      .subscribe(categoryList => {
        if (!isNil(categoryList)) {
          this.categories = categoryList
          this.isCategoryLoading = false;
          this.productListA$ = this.categories.length > 0 ? this.productService.getProducts([get(first(this.categories), 'Id')], 5, 1).pipe(map(results => this.createItemRequest(get(results, 'Products')))) : of([]);
          this.productListB$ = this.categories.length > 1 ? this.productService.getProducts([get(this.categories[1], 'Id')], 5, 1).pipe(map(results => this.createItemRequest(get(results, 'Products')))) : of([]);
        }
        else {
          this.categories = [];
          this.isCategoryLoading = false;
        }
      }));
  }

  createItemRequest(products: Array<Product>): Array<ItemRequest> {
    this.listItem = [];
    forEach(products, product => {
      const itemReq = {
        Product: product,
        Quantity: 1,
        Id: get(product, 'Id')
      } as ItemRequest
      this.listItem.push(itemReq)
    })
    return this.listItem
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
