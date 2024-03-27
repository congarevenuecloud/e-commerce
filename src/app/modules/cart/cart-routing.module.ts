/**
 * Conga Digital Commerce
 *
 * Dedicated routing module for the cart module.
 */
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CartComponent } from './layout/cart.component';

const routes: Routes = [
  {
      path: '',
      component: CartComponent
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
