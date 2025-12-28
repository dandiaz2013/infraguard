import Dashboard from './pages/Dashboard';
import Matters from './pages/Matters';
import Research from './pages/Research';
import MatterDetail from './pages/MatterDetail';
import ArgumentBuilder from './pages/ArgumentBuilder';
import DocumentGenerator from './pages/DocumentGenerator';


export const PAGES = {
    "Dashboard": Dashboard,
    "Matters": Matters,
    "Research": Research,
    "MatterDetail": MatterDetail,
    "ArgumentBuilder": ArgumentBuilder,
    "DocumentGenerator": DocumentGenerator,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};