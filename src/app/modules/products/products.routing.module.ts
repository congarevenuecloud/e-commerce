import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ProductListComponent } from './list/product-list.component';
import { ProductDetailComponent } from './detail/product-detail.component';
import { ConfigureGuard } from '../../services/configure.guard';
const routes: Routes = [
  {
    path: '',
    component: ProductListComponent
  },
  {
    path: 'compare',
    loadChildren: () => import('../../modules/compare/compare.module').then(m => m.CompareModule),
    data: { title: 'Product Comparison' }
  },
  {
    path: ':id',
    component: ProductDetailComponent,
    canDeactivate: [ConfigureGuard]
  },
  {
    path: 'category/:categoryId',
    component: ProductListComponent
  },
  {
    path: ':id/:cartItem',
    component: ProductDetailComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductsRoutingModule { }
