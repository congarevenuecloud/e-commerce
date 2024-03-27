/**
 * Conga Digital Commerce
 *
 * Dedicated routing module for the home module.
 */
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './layout/home.component';

const routes: Routes = [
    {
        path: '',
        component: HomeComponent
    }
];

/**
 * @internal
 */
@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class HomeRoutingModule { }
