import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MyAccountLayoutComponent } from './layout/my-account-layout.component';
import { DashboardComponent } from './component/dashboard/dashboard.component';
import { OrderListComponent } from './component/order-list/order-list.component';
import { QuoteListComponent } from './component/quote-list/quote-list.component';
import { SettingsComponent } from './component/settings/settings.component';
import { CartListComponent } from './component/cart-list/cart-list.component';
import { FavoriteListComponent } from './component/favorite-list/favorite-list.component';



const routes: Routes = [
  {
    path : '',
    component: MyAccountLayoutComponent,
    children : [
      {
        path : 'dashboard',
        component : DashboardComponent
      },
      {
        path : 'orders',
        component : OrderListComponent
      },
      {
        path : 'quotes',
        component : QuoteListComponent
      },
      {
        path : 'settings',
        component : SettingsComponent
      },
      {
        path : 'carts',
        component : CartListComponent
      },
      {
        path : 'favorites',
        component : FavoriteListComponent
      },
      {
        path : '',
        redirectTo : 'dashboard',
        pathMatch : 'full'
      }
    ]
  }
];

/**
 * @internal
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MyAccountRoutingModule { }
