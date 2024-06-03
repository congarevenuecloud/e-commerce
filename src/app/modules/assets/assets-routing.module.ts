import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AssetListComponent } from './list/asset-list.component';


const routes: Routes = [
  {
    path: '',
    component: AssetListComponent
  },
  {
    path: ':operation/:productId',
    component: AssetListComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AssetsRoutingModule { }
