import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { OrderDetailComponent } from './layout/order-details/order-detail.component';

const routes: Routes = [
  {
    path: ':id',
    component: OrderDetailComponent
  },
  {
    path: '',
    redirectTo: '/my-account/orders',
    pathMatch: 'full'
  }
];

/**
 * @internal
 */
@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class OrderRoutingModule { }
