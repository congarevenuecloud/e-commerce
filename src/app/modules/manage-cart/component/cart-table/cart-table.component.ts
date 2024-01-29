import { Component, OnChanges, Input } from '@angular/core';
import { Cart, CartItem } from '@congarevenuecloud/ecommerce';
import * as _ from 'lodash';

/**
 * Cart Table Component displays the list of cart line items.
 */
@Component({
  selector: 'app-cart-table',
  templateUrl: './cart-table.component.html',
  styleUrls: ['./cart-table.component.scss']
})
export class CartTableComponent implements OnChanges {
  /**
   * Instance of the current cart.
   */
  @Input() cart: Cart;
  /**
   * Array of TableItem objects used to create each primary row in the table.
   */
  tableItems: Array<TableCartItem> = [];
  /**
   * @ignore
   */
  ngOnChanges() {
    this.tableItems = [];
    if (this.cart && _.get(this.cart.LineItems, 'length') > 0) {
      _.get(this.cart,'LineItems').filter(cartItem => {
        return cartItem.IsPrimaryLine && cartItem.LineType === 'Product/Service';
      })
      .forEach(lineItem => {
        this.tableItems.push({
          parent: lineItem,
          children: this.cart.LineItems.filter(cartItem => !cartItem.IsPrimaryLine && cartItem.PrimaryLineNumber === lineItem.PrimaryLineNumber)
        });
      });
    }
  }

  trackById(index, record: CartItem): string {
    return _.get(record, 'Id');
  }
}
/**
 * Table items are used to hold records of matching parent child relationships for cart items based on primary and non primary line items.
 * @ignore
 */
interface TableCartItem {
  /**
   * A primary line item.
   */
  parent: CartItem;
  /**
   * An array of non primary line items with matching primary line numbers as the parent field.
   */
  children: Array<CartItem>;
}
