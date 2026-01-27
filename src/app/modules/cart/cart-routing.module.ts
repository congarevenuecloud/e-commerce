/**
 * Conga Digital Commerce
 *
 * Dedicated routing module for the cart module.
 */
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CartComponent } from './layout/cart.component';
import { SecureCheckoutComponent } from './layout/secure-checkout/secure-checkout.component';

const routes: Routes = [
  {
      path: '',
      component: CartComponent
  },
  {
      path: 'secure-checkout',
      component: SecureCheckoutComponent
  }
];

/**
 * @internal
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CartRoutingModule { }
